define([], function () {

	'use strict';
	
	return function GenericFilter(getField) {
		return [function () { // Returns filter factory.
			return function FilterBy(xs, filters) { // The filter.
				if (!xs) return xs;
				console.log('FILTERING', xs, filters);
				return xs.filter(function(x) {

		            return filters.length ===0 || filters.indexOf(getField(x)) >= 0;

		        });
			}
		}];
	}
});