/** Load sub modules, and get a reference to angular **/
define(['angular', './controllers', './services'], function (angular) {

	'use strict';
	
	var App = angular.module('multimine-search-tool', [
		'ngRoute',
    'multimine-search-tool.controllers',
    'multimine-search-tool.services'
  ]);

  App.config(function ($routeProvider) {
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
