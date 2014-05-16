// main.js
require.config({
    baseUrl: 'js',
    paths: {
        underscore: '/bower_components/underscore/underscore',
        angular: '/bower_components/angular/angular', 
        imjs: '/bower_components/imjs/js/im',
		"angular-route": '/bower_components/angular-route/angular-route',
		"angular-ui": '/bower_components/angular-ui-bootstrap-bower/ui-bootstrap-tpls',
		domReady: '/bower_components/requirejs-domready/domReady'
    },
	shim: {
	    'angular': {
	      exports: 'angular'},
	    'angular-route': ['angular'],
	    'angular-ui': ['angular'],
		underscore: {exports: '_'},
	    priority: [ 'angular' ]
	}
});


var deps = ['domReady!', 'angular', 'angular-route','app'];

require(deps, function(document, ng) {
  //The call to setTimeout is here as it makes loading the app considerably more reliable.
  // Depending on compilation sequence, various modules were not being found. This is dumb, and
  // a better way ought to be found.
  setTimeout(function () {ng.bootstrap(document, ['multimine-search-tool']);}, 100);
});