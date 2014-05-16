define(['underscore', 'imjs'], function (_, intermine) {
	'use strict';	
	
	var item = {
	  mines: [
	  	{
	      name: "FlyMine",
	      queryUrl: "http://www.flymine.org/query",
	      baseUrl: "http://www.flymine.org/release-38.0/",
	      server: "www.flymine.org"
	     },
	    {
	      name: "MouseMine",
	      queryUrl: "www.mousemine.org/mousemine",
	      baseUrl: "http://www.mousemine.org/mousemine/",
	      server: "www.mousemine.org"
	    },
	    {
	      name: "ModMine",
	      queryUrl: "http://intermine.modencode.org/query/",
	      baseUrl: "http://intermine.modencode.org/release-32/",
	      server: "intermine.modencode.org"
	    },
	    {
	      name: "ZebraFishMine",
	      queryUrl: "http://www.zebrafishmine.org",
	      baseUrl: "http://www.zebrafishmine.org/",
	      server: "www.zebrafishmine.org"
	    },
	    {
	      name: "YeastMine",
	      queryUrl: "http://yeastmine.yeastgenome.org/yeastmine",
	      baseUrl: "http://yeastmine.yeastgenome.org/yeastmine/",
	      server: "yeastmine.yeastgenome.org"
	    },
	    {
	      name: "WormMine",
	      queryUrl: "http://www.wormbase.org/tools/wormmine",
	      baseUrl: "http://www.wormbase.org/tools/wormmine/",
	      server: "www.wormbase.org"
	    }
	  ],
	  timeout: 200
	};
	
	return ['$scope', '$q', '$timeout', '$filter', SearchResultsCtrl];
	
	function SearchResultsCtrl ($scope, $q, $timeout, $filter) {

		$scope.stats = {categories: {}}; // Holds our statistics
		$scope.results = []; // Holds our final results
		$scope.genusFilter = [];
		$scope.categoryFilter = [];

		$scope.toggleFilter = function(arrName, value) {

			if ($scope[arrName].indexOf(value) != -1)
			{
				$scope[arrName] = _.without($scope[arrName], value);
			} else {
				$scope[arrName].push(value);
			}

		};

		$scope.callme = function (searchterm) {
			if (!searchterm) return;

			// Manage our returned data:
			
			$q.all(_.map(item.mines, quicksearch.bind(null, searchterm, 200)))
			  .then(function(mineResultSets) {
				$timeout(function () {
				
					console.log("mineResultSets: ", mineResultSets);

					buildStats($scope, mineResultSets);
					nestOrganisms($scope, mineResultSets);

					// Convert the categories objects into an array of objects (for filtering)
					buildCategories($scope);
				});
			});
					
		};
		
		$scope.$watch('step.data.searchTerm', $scope.callme);
	}
			
	function buildStats ($scope, mineResultSets) {
		_.forEach(mineResultSets, function(value, key) {

			// Each set is the quicksearch results from a different mine
			var nextSet = value;

			// Not all mines return organisms in the same format. While not fool proof,
			// it's likely to be result.fields['organism.name'] or result.fields['organism.shortName']/
			// We need to standardize in order for filtering to work!

			// First handle organism.name:


			// Calculate the number of results returned per category:
			for (var i = 0; i < nextSet.results.length; i++) {

				// Attach the mine information to each result for filtering:
				nextSet.results[i].mine = nextSet.mine;
				var nextResult = nextSet.results[i];


				// if (nextResult.type == "Publication") {
				// 	continue;
				// } else {

					$scope.results.push(nextResult);

				// }

				if (nextResult.type in $scope.stats.categories) {
					$scope.stats.categories[nextResult.type] = $scope.stats.categories[nextResult.type] + 1;
				} else {
					$scope.stats.categories[nextResult.type] = 1;
				}

			}

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
	
	function quicksearch(needle, timeout, mine) {

			var service = intermine.Service.connect({root: mine.queryUrl});

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

});