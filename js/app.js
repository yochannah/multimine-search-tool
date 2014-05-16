define(['angular', './controllers', './filters'], function (angular) {
	'use strict';
	
	angular.module('multimine-search-tool', [
		'ngRoute', 'multimine-search-tool.controllers', 'multimine-search-tool.filters'])
	.config(function ($routeProvider) {


		$routeProvider.when('/', {
			controller: 'MainCtrl',
			templateUrl: 'index.html'
		}).when('/:status', {
			controller: 'MainCtrl',
			templateUrl: 'index.html'
		}).otherwise({
			redirectTo: '/'
		});
	});
});
