define([
    'underscore',
    'imjs',
    './results-row'
    ], function (_, intermine, RowController) {

	'use strict';	
	
  var config = {
    timeout: 200,
    defaultCategory: {
      genomic: 'organism.name'
    },
    categoryName: {
      genomic: 'Organism'
    },
    categories: {
      genomic: ['organism.name', 'organism.shortName']
    }
  };

	return ['$scope', '$q', '$timeout', '$filter', 'Mines', SearchResultsCtrl];
	
	function SearchResultsCtrl ($scope, $q, $timeout, $filter, Mines) {

    var allMines = Mines.all().then(function (mines) {
      return mines.map(function (mine) {
        var service = intermine.Service.connect(mine);
        service.name = mine.name;
        return service;
      });
    });

    // Define initial state.
    init();

    $scope.RowController = RowController;

    // Make sure that the search reflects the search term, and that the filtered results
    // reflect the facets.
		$scope.$watch('step.data.searchTerm', search);
    $scope.$watch(_.compose(JSON.stringify, watchForCategories), inTimeout(function () {
      $scope.categories = watchForCategories($scope);
    }));
    $scope.$watch('categories', filterResults);
    $scope.$watch('results', filterResults);
    $scope.$watch('filteredResults', _.throttle(reportResults, 250));

    //--- Controller scoped functions.

    // (Re-)Initialise the state of the controller.
    function init () {
      $scope.complete = false;
      $scope.categories = []; // Would be nice to avoid this.
      $scope.percentDone = 0;
      if (!$scope.state) {
        $scope.state = {};
      }
      $scope.state.facets = {Organism: {}, Type: {}};
      $scope.results = []; // Holds our final results
      $scope.filterResults = [];
      $scope.selectedGenera = [];
      $scope.selectedOrganisms = [];
    }

    var frn = 0;

    // Apply the filters (initially empty) to build the initial state. Needs $scope
    function filterResults () {
      $scope.filteredResults = applyFilters($scope.results, ($scope.categories || []));
    }

    var n = 0;

    // Report the values found.
    // emits a 'has' message for each set of items found at a mine.
    function reportResults (filteredResults) {
      var byMine = _.groupBy(filteredResults, by('mine.root'));
      var allTypes = _.pluck($scope.results, 'type');
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

		function search (searchterm) {
			if (!searchterm) return;

      // Start the search.
      var searchingAll = allMines.then(searchAllFor(searchterm, 200));
      var done = 0;
      init(); // Reinitialise.

      // Supply progress notifications.
      searchingAll.then(function (promises) {
        var n = promises.length;
        promises.forEach(function (promise) {
          var fn = inTimeout(function () {
            done++;
            $scope.percentDone = (done / n * 100).toFixed();
            $scope.complete = (done === n);
          });
          promise.then(fn, fn);
        });
      });
          
			// process our returned data:
      searchingAll.then(function (promises) {
        promises.forEach(function (promise) {
          promise.then(processResultSet);
        });
      });
					
		}

    function processResultSet (resultSet) {

      // Not all mines return organisms in the same format. While not fool proof,
      // it's likely to be result.fields['organism.name'] or result.fields['organism.shortName']/
      // We need to standardize in order for filtering to work!

      // Calculate the number of results returned per category:
      resultSet.results.forEach(inTimeout(function (result, i) {

        // Attach the mine information to each result for filtering:
        result.mine = resultSet.mine;

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
	function fetchDisplayNames (service, className) {
		return service.fetchModel().then(function (model) {
      var types = [className].concat(model.getAncestorsOf(className));
      return types.map(function (path) {
        return model.makePath(path).getDisplayName();
      });
		});
	}
	
	function quicksearch(needle, timeout) {
    return function (service) {

			// var rejection = setTimeout((function() {
			// 	deferred.reject("TIMEOUT");
			// 	$scope.$apply();
			// }), 200);

			return service.search(needle).then(function(values) {

				// Attach the mine to the result for later filtering
				values.mine = service;

				// Resolve our promise
				return values;
			});
    };
	}

  function searchAllFor(searchterm, timeout) {
    return function (mines) {
      return mines.map(quicksearch(searchterm, timeout));
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

});
