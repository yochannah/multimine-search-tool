define(['underscore', './controllers/search-results'], function (_, SearchResultsCtrl) {
	var Controllers = angular.module('multimine-search-tool.controllers', []);

	Controllers.controller('DemoCtrl', ['$scope', function (scope) {
    scope.step = {data: {}};
  }]);

	Controllers.controller('SearchInputCtrl', ['$scope', function (scope) {
  }]);

	Controllers.controller('SearchResultsCtrl', SearchResultsCtrl);

});
