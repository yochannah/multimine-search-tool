define([
	'angular',
	'underscore',
	'./filters/selected-tags',
	'./filters/selected-genus'], function (angular, _, selectedTags, selectedGenus) {
		
	'use strict';
	
	var Filters = angular.module('multimine-search-tool.filters', []);
	
	Filters.filter('selectedTags', selectedTags);
	Filters.filter('selectedGenus', selectedGenus);
});