angular.module('multimine-search-tool', ['ngRoute'])
	.config(function ($routeProvider) {
		'use strict';

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
