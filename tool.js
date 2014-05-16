define([
	'app',
	'./js/controllers/search-results',
	'./js/filters/selected-genus',
	'./js/filters/selected-tags'], function (staircase, SearchResultsCtrl, selectedGenusFac, selectedTagsFac) {
	
	'use strict';
	
	staircase.filters.register('selectedTags', selectedTagsFac);
	staircase.filters.register('selectedGenus', selectedGenusFac);
	
	/**
	* scope.step.data = {searchTerm: string}
	*/
	return SearchResultsCtrl;
	
});