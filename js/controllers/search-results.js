define([
    'underscore',
    'imjs',
    './results-row'
    ], function (_, intermine, resultsrow) {

	'use strict';	
	
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
	return ['$scope', '$q', '$timeout', '$filter', 'Mines', SearchResultsCtrl];
	
  /**
   * @param {Scope} $scope An angularjs scope.
   * @param {Q} $q A Q-like interface.
   * @param {Function} $timeout A timeout function 
   * @param {Mines} Mines A mines resource.
   */
	function SearchResultsCtrl ($scope, $q, $timeout, $filter, Mines) {

    // Request all the configured datasources from the host, storing
    // a promise for the response.
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
    $scope.RowController = resultsrow.controller;

    // Make sure that the search reflects the search term, and the facets.
		$scope.$watch('step.data.searchTerm', search);
    //$scope.$watch(watchAppliedFacets, search);

    //--- Controller scoped functions.

    // (Re-)Initialise the state of the controller.
    function init () {
      $scope.complete = false;
      $scope.percentDone = 0;
      $scope.failed = 0;
      $scope.showFailed = true;
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
      console.log("searching for ", searchterm);
			if (searchterm == null) return; // empty string means "search for everything".

      // Start the search.
      var searchingAll = allMines.then(searchFor(searchterm));
      var done = 0;
      init(); // Reinitialise.

			// process our returned data:
      // Note, we are *not* using $q.all, since that will bail if
      // any search fails, and we are ok if some of them do.
      searchingAll.then(function (promises) {
        // Supply progress notifications.
        var n = promises.length;
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
    function reportResults (filteredResults) {
      var allTypes = _.pluck($scope.results, 'type')
        , byMine   = _.chain(filteredResults)
                      .where({selected: true})
                      .groupBy(by('mine.root'))
                      .value();
      allMines.then(function (mines) {
        mines.forEach(function (mine) {
          mine.fetchModel().then(function (model) {
            var results, byType, ids, types, commonType, type;
            results = (byMine[mine.root] || []);

            byType = _.groupBy(results, by('type'));
            allTypes
             .filter(function (type) { return !byType[type]; })
             .forEach(function (type) { byType[type] = []; });
            ids = _.pluck(results, 'id');
            types = _.uniq(_.pluck(results, 'type'));
            for (type in byType) {
              hasItems(mine, byType[type].map(by('id')), type);
            }
          }).then(null, console.error.bind(console));
        });
      });
    }

    // Emit a message about the availability of sets of items.
    function hasItems(mine, ids, type) {
      $scope.$emit('has', {
        what: 'ids',
        key: mine.root + type,
        data: {
          service: {root: mine.root, name: mine.name},
          request: {ids: ids, type: type}
        }
      });
    }

    function processResultSet (resultSet) {
      console.log('RECEIVED', resultSet.mine.name, resultSet.results.length);
      var results = getResults(resultSet);
      $scope.state.results = $scope.state.results.concat(results);

      return;

      // Not all mines return organisms in the same format. While not fool proof,
      // it's likely to be result.fields['organism.name'] or result.fields['organism.shortName']/
      // We need to standardize in order for filtering to work!

      // Calculate the number of results returned per category:
      resultSet.results.forEach(inTimeout(function (result, i) {

        // Attach the mine information to each result for filtering:
        result.mine = resultSet.mine;
        result.selected = true; // Selected by default.

        // Use concat to trigger dirty check.
        $scope.results = $scope.results.concat([result]);

        // Update type facets.
        fetchDisplayNames(result.mine, result.type).then($q.all).then(function (names) {
          result.typeNames = names;
          names.forEach(inTimeout(addFacet.bind(null, $scope.state.facets.Type, 'type')));
        });

        // Update category facets (usually means organism).
        result.mine.fetchModel().then(function (model) {
          var prop = _.find(config.categories[model.name] || [], function (p) { return result.fields[p]; })
            , defaultProp = config.defaultCategory[model.name]
            , facetName = config.categoryName[model.name]
            , facetGroup = $scope.state.facets[facetName];
          if (!prop) return;
          if (defaultProp === prop) { // If supplied use it.
              $timeout(addFacet.bind(null, facetGroup, facetName, result.fields[prop]));
          } else { // if not, query for it and use that.
            result.mine
                  .rows({select: defaultProp, from: result.type, where: {id: result.id}})
                  .then(inTimeout(function (rows) {
                    if (rows[0]) {
                      var value = rows[0][0];
                      result.fields[defaultProp] = value;
                      addFacet(facetGroup, facetName, value);
                    }
                  }));
          }
        });
      }));

    }

    // Helper for de-nesting blocks by wrapping a block in a timeout.
    // Needs $timeout so must be declared within controller injection scope.
    // _could_ be made into a service, but that would be overkill.
    function inTimeout (f) {
      return function (x) { $timeout(function () { f(x); }); };
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

	function quicksearch(needle) {
    /** @param {imjs.Service} service The service to search **/

    return function (service) {
      var size = 100;   // Return no more than 100 results.
      var key = service.root + "|" + needle;
      if (_searches[key]) {
        return _searches[key]
      } else {
        return _searches[key] = service.post(
          'search',
          {q: needle, size: size}
        ).then(function(result) {
          // Attach the mine to the result for later filtering
          result.mine = service;

          // Resolve our promise
          return result;
        });
			}
    };
	}

  function searchFor(searchterm) {
    return function (mines) {
      return mines.map(quicksearch(searchterm));
    }
  };

  // Null safe application of Array.filter(f) to list
  function filterList (list, f) { return list && list.filter(f); };

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

  function watchAppliedFacets (scope) {
    return _.flatten(_.values(scope.state.facets)).filter(isSelected).map(getName).join(':');

    function isSelected (x) {
      return x.selected;
    }
    function getName (x) {
      return x.name;
    }
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



});
