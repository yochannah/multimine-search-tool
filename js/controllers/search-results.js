define(['underscore', 'imjs', '../filters'], function (_, intermine, filters) {
	'use strict';	
	
  var config = {
    timeout: 200,
    defaultCategory: {
      genomic: 'organism.name'
    },
    categoryName: {
      genomic: 'Organisms'
    },
    categories: {
      genomic: ['organism.name', 'organism.shortName']
    }
  };

	return ['$scope', '$q', '$timeout', '$filter', 'Mines', SearchResultsCtrl];
	
	function SearchResultsCtrl ($scope, $q, $timeout, $filter, Mines) {

    // Define initial state.
    init();

    // Make sure that the search reflects the search term, and that the filtered results
    // reflect the facets.
		$scope.$watch('step.data.searchTerm', search);
    $scope.$watch(_.compose(JSON.stringify, watchForCategories), inTimeout(function () {
      $scope.categories = watchForCategories($scope);
    }));
    $scope.$watch('categories', filterResults);
    $scope.$watch('results', filterResults);

    function init () {
      $scope.complete = false;
      $scope.categories = []; // Would be nice to avoid this.
      $scope.percentDone = 0;
      $scope.facets = {Organisms: {}, Types: {}};
      $scope.results = []; // Holds our final results
      $scope.filterResults = [];
      $scope.selectedGenera = [];
      $scope.selectedOrganisms = [];
    }

    // Apply the filters (initially empty) to build the initial state. Needs $scope
    function filterResults () {
      $scope.filteredResults = applyFilters($scope.results, ($scope.categories || []));
    }

    // Helper for de-nesting blocks by wrapping a block in a timeout. Needs $timeout
    function inTimeout (f) {
      return function (x) { $timeout(function () { f(x); }); };
    }

		function search (searchterm) {
			if (!searchterm) return;

      // Start the search.
      var searchingAll = Mines.all().then(searchAllFor(searchterm, 200));
      var done = 0;
      init(); // Reinitialise.

      // Supply progress notifications.
      searchingAll.then(function (promises) {
        var n = promises.length;
        promises.forEach(function (promise) {
          promise.then(inTimeout(function () {
            done++;
            $scope.percentDone = (done / n * 100).toFixed();
          }));
        });
      });
          
			// process our returned data:
      searchingAll.then(function (promises) {
        promises.forEach(function (promise) {
          promise.then(processResultSet);
        });
      });

      searchingAll.then($q.all).then(inTimeout(function () {
        $scope.complete = true;
      }));
					
		}

    function processResultSet (resultSet) {

      // Not all mines return organisms in the same format. While not fool proof,
      // it's likely to be result.fields['organism.name'] or result.fields['organism.shortName']/
      // We need to standardize in order for filtering to work!

      // First handle organism.name:


      // Calculate the number of results returned per category:
      resultSet.results.forEach(inTimeout(function (result, i) {

        // Attach the mine information to each result for filtering:
        result.mine = resultSet.mine;

        // if (nextResult.type == "Publication") {
        // 	continue;
        // } else {

        $scope.results = $scope.results.concat([result]);

        // count occurances of results of this type.

        fetchDisplayNames(result.mine, result.type).then($q.all).then(function (names) {
          result.typeNames = names;
          names.forEach(inTimeout(addFacet.bind(null, $scope.facets.Types, 'type')));
        });

        result.mine.fetchModel().then(function (model) {
          var prop = _.find(config.categories[model.name] || [], function (p) { return result.fields[p]; })
            , defaultProp = config.defaultCategory[model.name]
            , facetName = config.categoryName[model.name]
            , facetGroup = $scope.facets[facetName];
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
  }

  /*
   * Return the result of passing the results through the tag filter and the organism filter.
   */
  function applyFilters(results, categories) {
    var types = categories.filter(propIs('name', 'type')).filter(isSelected)
      , organisms = categories.filter(propIs('name', 'Organisms')).filter(isSelected);

    console.log(_.uniq(_.pluck(categories, 'name')), _.pluck(types, 'value'), _.pluck(organisms, 'value'));

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
    return function (mine) {

			var service = intermine.Service.connect(mine);
      service.name = mine.name;

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
    _.forEach(scope.facets, function (facetGroup, name) {
      categories = categories.concat(_.values(facetGroup));
    });
    return categories;
  }

});
