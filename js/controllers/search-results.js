define([
    'underscore',
    'imjs',
    './results-row'
    ], function (_, intermine, resultsrow) {

	'use strict';

  var j = 0;

  var config = {
    timeout: 200,
    defaultCategory: {
      genomic: 'organism.name'
    },
    categoryName: {
      genomic: 'Organism'
    }
  };
  var connect = intermine.Service.connect;
  // Cache for searches.
  var _searches = {};

  // Return an angularjs controller.
	return ['$scope', '$q', 'Mines', SearchResultsCtrl];

  /**
   * @param {Scope} $scope An angularjs scope.
   * @param {Q} $q A Q-like interface.
   * @param {Mines} Mines A mines resource.
   */
	function SearchResultsCtrl ($scope, $q, Mines) {

    // Request all the configured datasources from the host, storing
    // a promise for the response. This is requested once and reused
    // in any place that needs access to the list of sources.
    var allMines = Mines.all().then(function (mines) {
      return mines.map(function (mine) {
        var service = connect(mine);
        service.name = mine.name; // Record the configured mine name.
        return service;
      });
    });

    // Define initial state.
    init();

    // Allow the template to refer to the correct controller.
    console.log(resultsrow.controller);
    $scope.RowController = resultsrow.controller;

    // Trigger a search when we should.
		$scope.$watch(searchWatch, search);
    $scope.$watch('state.results', reportResults);

		$scope.$watch('step.data.searchTerm', function (term) {
      $scope.termParts = term ? term.split(' ').map(normalise) : [];

      function normalise (p) {
        return p.replace(/\*/g, '').toLowerCase();
      }
    });

    // Used for highlighting matched terms.
    $scope.termMatched = function (term) {
      if (!term || !$scope.termParts) return false;
      return _.any($scope.termParts, function (p) {
        return String(term).toLowerCase().indexOf(p) >= 0;
      });
    };

    $scope.toggleSelectAll = function(){
      $scope.allSelected ? deselectAll() : selectAll();
    };

    var selectAll = function () {
      $scope.state.results.forEach(function (r) {
        r.selected = true;
      });
      $scope.allSelected = true;
    };

     var deselectAll = function () {
      $scope.state.results.forEach(function (r) {
        r.selected = false;
      });
      $scope.allSelected = false;
    };

    //--- Controller scoped functions.

    // (Re-)Initialise the state of the controller.
    function init () {
      $scope.complete = false;
      $scope.percentDone = 0;
      $scope.failed = 0;
      $scope.allSelected=false;
      $scope.showFailed = true;
      $scope.numberOfSources = 0;
      $scope.state = {
        // Facets come in sets, eg: {Category: [{name: x, count: y, selected: false}]}
        // they are aggregated from the facets returned from search results.
        facets: {},
        // the combined search results.
        results: []
      };
    }

		function search () {
      var searchterm = soakGet($scope, ['step', 'data', 'searchTerm']);
      var facets = $scope.appliedFacets = getAppliedFacets($scope);
      console.log("searching for ", searchterm, facets);
      // empty string means "search for everything", but null
      // means not initialised yet.
			if (searchterm === null) return;

      // Start the search.
      var searchingAll = allMines.then(searchFor(searchterm, facets));
      var done = 0;
      init(); // Reinitialise.

			// process our returned data:
      // Note, we are *not* using $q.all, since that will bail if
      // any search fails, and we are ok if some of them do.
      searchingAll.then(function (promises) {
        // Supply progress notifications.
        var n = $scope.numberOfSources = promises.length;
        var whenned = promises.map($q.when);
        eachPromise(whenned, onProgress, _.compose(onProgress, onFailure));
        eachPromise(whenned, processResultSet);

        function onProgress (promise) {
          done++;
          $scope.percentDone = (done / n * 100).toFixed();
          $scope.complete = (done === n);
        }

        function onFailure () {
          $scope.failed++;
        }
      });
		}

    // Report the values found.
    // emits a 'has' message for each set of items found at a mine.
    function reportResults () {
      var results  = soakGet($scope, ['state', 'results']) || [];
      var allTypes = _.uniq(_.pluck(results, 'type'));
      var byMine   = _.chain(results)
                      .where({selected: true})
                      .groupBy(by('mine.root'))
                      .value();
      allMines.then(function (mines) {
        mines.forEach(function (mine) {
          var results = (byMine[mine.root] || []);
          var byType = _.groupBy(results, by('type'));
          allTypes.forEach(function (t) {
            if (!byType[t]) {
              byType[t] = [];
            }
          });
          var types = _.uniq(_.pluck(results, 'type'));

          _.each(byType, function (items, type) {
            hasItems(mine, items.map(by('id')), type);
          });
        });
      }).catch(function (err) {
        console.error(err);
      });
    }

    // Emit a message about the availability of sets of items.
    function hasItems (mine, ids, type) {
      var data = (!ids || !ids.length) ? null : {
        service: {root: mine.root, name: mine.name},
        request: {ids: ids, type: type}
      };
      $scope.$emit('has', {
        what: 'ids',
        key: mine.root + type,
        data: data
      });
    }

    function processResultSet (resultSet) {
      var results = getResults(resultSet);
      var facets = getFacets(resultSet);

      $scope.state.results = $scope.state.results.concat(results);
      $scope.state.facets = mergeFacets($scope.appliedFacets, $scope.state.facets, facets);

      return;

    }

  }

  // Apply the success and error functions to each result in a set
  // of promises.
  function eachPromise (promises, fn, err) {
    _.each(promises, function (p) {
      p.then(fn, err);
    });
  }

  /*
   * Return the result of passing the results through the tag filter and the organism filter.
   */
  function applyFilters(results, categories) {
    var types = categories.filter(propIs('name', 'type')).filter(isSelected)
      , organisms = categories.filter(propIs('name', 'Organism')).filter(isSelected);

    return [isOneOf(types), belongsToOneOf(organisms)].reduce(filterList, results);
  }

  function belongsToOneOf (organisms) {
    if (!organisms || !organisms.length) {
      return always(true);
    } else {
      return function (result) {
        return organisms.some(function (orgFacet) {
          return orgFacet.value === result.fields['organism.name'];
        });
      };
    }
  }

  function isOneOf (types) {
    if (!types || !types.length) {
      return always(true);
    } else {
      return function (result) {
        return overlaps(_.pluck(types, 'value'), result.typeNames);
      };
    }
  }

  function always(value) {
    return function() { return value; };
  }

  function overlaps(xs, ys) {
    return xs && ys && xs.some(function (x) { return ys.indexOf(x) >= 0; });
  }

  function propIs(prop, value) {
    return function(obj) {
      return obj && obj[prop] === value;
    };
  }

  function isSelected(x) {
    return x && x.selected;
  }

	/** Returns Promise<String>
	 * eg fetchDisplayName(service, "Gene.symbol") => Promise["Gene > Symbol"]
	**/
  var nameCache = {};
	function fetchDisplayNames (service, className) {
    if (nameCache[service.root]) {
      return nameCache[service.root];
    } else {
      return nameCache[service.root] = service.fetchModel().then(function (model) {
        var types = [className].concat(model.getAncestorsOf(className));
        return types.map(function (path) {
          return model.makePath(path).getDisplayName();
        });
      });
		}
	}

	function quicksearch(needle, facets) {
    /** @param {imjs.Service} service The service to search **/

    return function (service) {
      var size = 100;   // Return no more than 100 results.
      var key = service.root + "|" + needle + '|' + facetsToKey(facets);
      if (_searches[key]) {
        return _searches[key];
      } else {
        var params = facetsToParams(facets);
        params.q = needle;
        params.size = size;
        return (_searches[key] = service.post(
          'search',
          params
        ).then(function(result) {
          // Attach the mine to the result for later filtering
          result.mine = service;

          // Resolve our promise
          return result;
        }));
			}
    };

	}

  function facetsToKey (facets) {
    return facets.map(function (f) { return f.facet + '=' + f.name; }).join(';');
  }

  function facetsToParams (facets) {
    var ret = {};
    facets.forEach(function (f) {
      ret['facet_' + f.facet] = f.name;
    });
    return ret;
  }

  function searchFor(searchterm, facets) {
    return function (mines) {
      return mines.map(quicksearch(searchterm, facets));
    };
  }

  // Null safe application of Array.filter(f) to list
  function filterList (list, f) { return list && list.filter(f); }

  // null safe mapping[key]++. Mutates mapping
  function increment (mapping, key) {
    mapping[key] = (mapping[key] || 0) + 1;
  }

  function addFacet(facets, name, thing) {
    var facet = (facets[thing] || (facets[thing] = {name: name, value: thing, count: 0}));
    facet.count++;
  }

  function watchForCategories(scope) {
    var categories = [];
    if (scope.state && scope.state.facets) {
      _.forEach(scope.state.facets, function (facetGroup, name) {
        categories = categories.concat(_.values(facetGroup));
      });
    }
    return categories;
  }

  function watchFilteredResults (scope) {
    return JSON.stringify(scope.filteredResults);
  }

  function by(x, orVal) {
    var parts = x.split('.');
    if (!parts.length) throw new Error("At least on property expected");
    if (parts.length === 1) {
      return function (y) { return (y && y[x]) || orVal; };
    } else {
      return function (y) {
        return parts.reduce(function (what, prop) {
          return (what && what[prop]) || orVal;
        }, y);
      };
    }
  }

  function getAppliedFacets (scope) {
    var facets = soakGet(scope, ['state', 'facets']);
    if (!facets) return [];
    var facetValues = _.flatten(_.values(facets).map(_.values));
    return _.uniq((scope.appliedFacets || []).concat(facetValues).filter(isSelected), false, facetKey);

    function isSelected (x) {
      return x.selected;
    }
  }

  function watchAppliedFacets (scope) {
    return _.uniq(getAppliedFacets(scope).map(facetKey)).join(':');
  }

  function facetKey (f) {
    return f.facet + '=' + f.name;
  }

  function searchWatch (scope) {
    return soakGet(scope, ['step', 'data', 'searchTerm'])
          + watchAppliedFacets(scope);
  }

  function soakGet (obj, path) {
    return _.reduce(path, function (o, p) {
      return o ? o[p] : null;
    }, obj);
  }

  // Return the results from each result set, parsed and munged as appropriate.
  // we add the mine so it is accessible to the row controller.
  function getResults (resultSet) {
    return resultSet.results.map(function (r) {
      r.mine = resultSet.mine;
      return r;
    });
  }

  function getFacets (resultSet) {
    return resultSet.facets || {};
  }

  // Produces a structure of the shape:
  // {
  //   setA: {
  //     facetA: {count: number},
  //     facetB: {count: number}
  //   setB: {
  //     facetX: {count: number}
  //  }
  // }
  function mergeFacets (appliedFacets, setA, setB) {
    var ret = {};
    var akeys = Object.keys(setA);
    var bkeys = Object.keys(setB);
    var allkeys = _.union(akeys, bkeys);
    var indexedCurrent = indexCurrent(appliedFacets);
    allkeys.forEach(function (k) {
      var agroup = (setA[k] || {});
      var bgroup = (setB[k] || {});
      var mergedGroup = {};
      var allfacets = _.union(_.keys(agroup), _.keys(bgroup));
      allfacets.forEach(function (f) {
        var current = (indexedCurrent[k] && indexedCurrent[k][f]);
        mergedGroup[f] = (agroup[f] || {facet: k, name: f, count: 0});
        mergedGroup[f].count += (bgroup[f] || 0);
        if (current) {
          current.count = mergedGroup[f].count;
          mergedGroup[f] = current; // This assignment means we can de-select it later.
        }
      });
      if (Object.keys(mergedGroup).length) {
        ret[k] = mergedGroup;
      }
    });
    return ret;
  }

  function indexCurrent (facets) {
    var ret = {};
    facets.forEach(function (f) {
      ret[f.facet] = {};
      ret[f.facet][f.name] = f;
    });
    return ret;
  }

  function countSelectedResults (scope) {
    _.where(soakGet(scope, ['state', 'results']) || [], {selected: true}).length;
  }

});
