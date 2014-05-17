define([
	'./filters/selected-tags',
	'./filters/selected-genus'], function (selectedTags, selectedGenus) {
		
	'use strict';

  return {byTag: selectedTags, byGenus: selectedGenus};
});
