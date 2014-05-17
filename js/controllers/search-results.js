define(['underscore', 'imjs', '../filters'], function (_, intermine, filters) {
	'use strict';	
	
  var config = {
	  timeout: 200
	};
	
	return ['$scope', '$q', '$timeout', '$filter', 'Mines', SearchResultsCtrl];
	
	function SearchResultsCtrl ($scope, $q, $timeout, $filter, Mines) {

    // Define initial state.
    init();

		$scope.toggleFilter = function(arrName, value) {

			if ($scope[arrName].indexOf(value) != -1)
			{
				$scope[arrName] = _.without($scope[arrName], value);
			} else {
				$scope[arrName].push(value);
			}

		};

    // Make sure that the search reflects the search term, and that the filtered results
    // reflect the facets.
		$scope.$watch('step.data.searchTerm', search);
    $scope.$watch('results', filterResults);
    $scope.$watch('selectedGenera', filterResults);
    $scope.$watch('selectedOrganisms', filterResults);

    function init () {
      $scope.complete = false;
      $scope.percentDone = 0;
      $scope.stats = {categories: {}}; // Holds our statistics
      $scope.results = []; // Holds our final results
      $scope.filterResults = [];
      $scope.selectedGenera = [];
      $scope.selectedOrganisms = [];
    }

    // Apply the filters (initially empty) to build the initial state. Needs $scope
    function filterResults () {
      $scope.filteredResults = applyFilters($scope.results, $scope.selectedGenera, $scope.selectedOrganisms);
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
          
			// Manage our returned data:
      searchingAll.then($q.all).then(inTimeout(function(mineResultSets) {
        buildStats($scope, mineResultSets);
        nestOrganisms($scope, mineResultSets);

        // Convert the categories objects into an array of objects (for filtering)
        buildCategories($scope);
        $scope.results = $scope.results.slice(); // trigger watches.
        $scope.complete = true;
      }));
					
		};
		
	}

  /*
   * Return the result of passing the results through the tag filter and the organism filter.
   */
  function applyFilters(results, genera, organisms) {
    return [filters.byTag(organisms), filters.byGenus(genera)].reduce(filterList, results);
  }
			
	function buildStats ($scope, mineResultSets) {
    // Each set is the quicksearch results from a different mine
		_.forEach(mineResultSets, function(nextSet, key) {

			// Not all mines return organisms in the same format. While not fool proof,
			// it's likely to be result.fields['organism.name'] or result.fields['organism.shortName']/
			// We need to standardize in order for filtering to work!

			// First handle organism.name:


			// Calculate the number of results returned per category:
      nextSet.results.forEach(function (result, i) {

				// Attach the mine information to each result for filtering:
				result.mine = nextSet.mine;

				// if (nextResult.type == "Publication") {
				// 	continue;
				// } else {

        $scope.results.push(result);

				// count occurances of results of this type.
        increment($scope.stats.categories, result.type);
			});

		});
		
	}
	
	function nestOrganisms ($scope, mineResultSets) {
		// Build our organism tree

		var orgnest = [];

		_.forEach(mineResultSets, function(value, key) {

			var nextSet = value;
			var orgTree = {"name": "All Organisms", "children": []};

			// Calculate the number of results returned per category:
			for (var i = 0; i < nextSet.results.length; i++) {

				var nextResult = nextSet.results[i];

				var nextOrganism = nextResult.fields["organism.name"];
				if(nextOrganism != null) {

					var split = nextOrganism.split(" ");

					var genus = split[0];
					var species = split[1];

					nextResult.fields.genus = genus;
					nextResult.fields.species = species;

					var found = _.findWhere(orgnest, {genus: genus, species: species});

					if (!found) {

						orgnest.push({"genus": genus, "species": species});
					}

				}

			}

		});


		$scope.orgnest = _.uniq(orgnest, function(item, key, a) {
			return item.genus;
		});
		
		// var nest = d3.nest()
		//     .key(function(d) { return d.genus; })
		//     .entries(orgnest);

		// console.log("nested", JSON.stringify(nest, null, 2));
		
	}
	
	function buildCategories ($scope) {
		var categories = [];
		_.forEach($scope.stats.categories, function(value, key) {

			categories.push({label: key, value: value});
		});

		$scope.categories = categories;
		console.log("scope categories:", JSON.stringify($scope.categories));

		console.log("scope.results:", $scope.results);
	}
	
	/** Returns Promise<String> 
	 * eg fetchDisplayName(service, "Gene.symbol") => Promise["Gene > Symbol"]
	**/
	function fetchDisplayName (service, path) {
		return service.fetchModel().then(function (model) {
			return model.makePath(path).getDisplayName();
		});
	}
	
	function quicksearch(needle, timeout) {
    return function (mine) {

			var service = intermine.Service.connect(mine);

			// var rejection = setTimeout((function() {
			// 	deferred.reject("TIMEOUT");
			// 	$scope.$apply();
			// }), 200);

			return service.search(needle).then(function(values) {

				// Attach the mine to the result for later filtering
				values.mine = mine;

				// Resolve our promise
				return values;
			});
    };
	};

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

});
