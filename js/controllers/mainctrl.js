
var mainmodule = angular.module('multimine-search-tool', []);

mainmodule.factory('Mine', function ($q) {

        return new intermine.Service({root: 'www.flymine.org/query'}); 

}).filter('selectedTags', function() {


	    return function(tasks, categoryFilter) {


	        return tasks.filter(function(task) {

	        	if (categoryFilter.length < 1) {
	        		return true;
	        	}

                if (categoryFilter.indexOf(task.type) != -1) {
                    return true;
                }

	            return false;

	        });
	    };

	}).filter('selectedGenus', function() {

	    return function(tasks, genusFilter) {

	        return tasks.filter(function(task) {

	        	if (genusFilter.length < 1) {
	        		return true;
	        	}

                if (genusFilter.indexOf(task.fields.genus) != -1) {
                    return true;
                }

	            return false;

	        });
	    };
	}).controller('MainCtrl', function TodoCtrl($scope, $q, $filter, Mine) {
		'use strict';

		$scope.stats = {}; // Holds our statistics
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

		
			var deferred = $q.defer();

			var promisearr = [];

			$scope.stats.categories = {};

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
			      queryUrl: "http://intermine.modencode.org/query",
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

			// Build an array of search promises:
			for (var mine in item.mines) {
				promisearr.push($scope.quicksearch(item.mines[mine], searchterm, 200));
			}

			// Manage our returned data:
			$q.all(promisearr).then(function(mineResultSets) {

				console.log("mineResultSets: ", mineResultSets);

				angular.forEach(mineResultSets, function(value, key) {

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

				// Build our organism tree

				var orgnest = [];

				angular.forEach(mineResultSets, function(value, key) {

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

				console.log("orgnest: ", orgnest);
				console.log("unique:", _.uniq(orgnest));
				$scope.orgnest = _.uniq(orgnest, function(item, key, a) {
					return item.genus;
				});


				// var nest = d3.nest()
				//     .key(function(d) { return d.genus; })
				//     .entries(orgnest);

				// console.log("nested", JSON.stringify(nest, null, 2));
			
				// Convert the categories objects into an array of objects (for filtering)
				var categories = [];
				angular.forEach($scope.stats.categories, function(value, key) {

					categories.push({label: key, value: value});
				});


				$scope.categories = categories;
				console.log("scope categories:", JSON.stringify($scope.categories));

				console.log("scope.results:", $scope.results);

			});




		};

		$scope.quicksearch = function(mine, needle, timeout) {

			var deferred = $q.defer();

			var service = new intermine.Service({root: mine.queryUrl});

			// var rejection = setTimeout((function() {
			// 	deferred.reject("TIMEOUT");
			// 	$scope.$apply();
			// }), 200);


			var results = service.search(needle).then(function(values) {

				// Attach the mine to the result for later filtering
				values.mine = mine;

				// Resolve our promise
				deferred.resolve(values);

				$scope.$apply();
			});

			return deferred.promise;


		};


		String.prototype.unCamelCase = function(){
			return this
				// insert a space between lower & upper
				.replace(/([a-z])([A-Z])/g, '$1 $2')
				// space before last upper in a sequence followed by lower
				.replace(/\b([A-Z]+)([A-Z])([a-z])/, '$1 $2$3')
				// uppercase the first character
				.replace(/^./, function(str){ return str.toUpperCase(); })
		}
	});
