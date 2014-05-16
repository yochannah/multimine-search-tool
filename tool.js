define([
	'app',
	'./js/controllers/search-results',
	'./filters/selected-genus',
	'./filters/selected-tags'], function (staircase, SearchResultsCtrl, selectedGenusFac, selectedTagsFac) {
	
	'use strict';
	
	staircase.filters.register('selectedTags', selectedTagsFac);
	staircase.filters.register('selectedGenus', selectedGenusFac);
	
	/**
	* scope.step.data = {searchTerm: string}
	*/
	return SearchResultsController;
	
});