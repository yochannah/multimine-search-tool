define(['underscore', './controllers/search-results'], function (_, SearchResultsCtrl) {
	var Controllers = angular.module('multimine-search-tool.controllers', []);
	Controllers.controller('MainCtrl', SearchResultsCtrl);
});
