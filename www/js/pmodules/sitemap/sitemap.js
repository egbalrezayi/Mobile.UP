define([
	'jquery',
	'underscore',
	'backbone',
	'utils',
	'q',
	'modules/campusmenu',
	'modules/timeselection',
	'pmodules/sitemap/sitemap.models',
	'pmodules/sitemap/searchablemap'
], function($, _, Backbone, utils, Q, campusmenu, timeselection, models, searchablemap){
	var rendertmpl = _.partial(utils.rendertmpl, _, "js/pmodules/sitemap");

	var settings = {};

	var terminals = "terminals";
	var institutes = "institutes";
	var canteens = "canteens";
	var parking = "parking";
	var associateinstitutes = "associateinstitutes";
	var student = "student";
	var sport = "sport";

	var categoryStore = new CategoryStore();
	var lastFinderId = undefined;
	var lastCampus = undefined;

	settings =	{
		getCampus: function(name) {
			var result = this.url[name];
			return result || this.url.golm;
		},
		initColors: function() {
			this.options.institutes.fillColor = $(".sitemap-institutes").css("background-color");
			this.options.parking.fillColor = $(".sitemap-parking").css("background-color");
			this.options.associateinstitutes.fillColor = $(".sitemap-associateinstitutes").css("background-color");
			this.options.student.fillColor = $(".sitemap-living").css("background-color");
			this.options.sport.fillColor = $(".sitemap-sport").css("background-color");
		},
		initCenters: function() {
			this.url.griebnitzsee.center = new google.maps.LatLng(52.39345677934452, 13.128039836883545);
			this.url.neuespalais.center = new google.maps.LatLng(52.400933, 13.011653);
			this.url.golm.center = new google.maps.LatLng(52.408716, 12.976138);
		},
		url: {
			griebnitzsee: {
				campus: "griebnitzsee"
			},
			neuespalais: {
				campus: "neuespalais"
			},
			golm: {
				campus: "golm"
			}
		},
		options: {
			terminals: { "icon": "img/up/puck-marker.png" },
			canteens: { "icon": "img/up/mensa-marker.png" },
			parking: {
				"strokeColor": "#fff",
			    "strokeOpacity": 1,
			    "strokeWeight": 2,
			    "fillColor": "#70c8dc",
			    "fillOpacity": 0.8
			},
			institutes: {
				"strokeColor": "#fff",
			    "strokeOpacity": 1,
			    "strokeWeight": 2,
			    "fillColor": "#e57967",
			    "fillOpacity": 0.8
			},
			associateinstitutes: {
				"strokeColor": "#fff",
			    "strokeOpacity": 1,
			    "strokeWeight": 2,
			    "fillColor": "#cf6da8",
			    "fillOpacity": 0.8
			},
			student: {
				"strokeColor": "#fff",
			    "strokeOpacity": 1,
			    "strokeWeight": 2,
			    "fillColor": "#897cc2",
			    "fillOpacity": 0.8
			},
			sport: {
				"strokeColor": "#fff",
			    "strokeOpacity": 1,
			    "strokeWeight": 2,
			    "fillColor": "#B6B6B4",
			    "fillOpacity": 0.8
			}
		}
	};

	var oneSidedGuard = {
		callback: function(options) { drawSelectedCampus(options); },
		isCalled: false,
		isBlocked: true,
		options: undefined,

		callMultiple: function(options) {
			if (this.isBlocked) {
				this.isCalled = true;
				this.options = options;
			} else {
				this.callback(options);
			}
		},

		disableBlock: function() {
			this.isBlocked = false;
			if (this.isCalled) {
				this.callback(this.options);
			}
		}
	};

	function checkUncheck(category) {
		return function() {
			var visibility = $(this).is(':checked');
			categoryStore.setVisibility(category, visibility);
			$("div[data-role='searchablemap']").searchablemap("resetAllMarkers");
		};
	}


	/*
	 * initialize map when page is shown
	 * "pageshow" is deprecated (http://api.jquerymobile.com/pageshow/) but the replacement "pagecontainershow" doesn't seem to trigger
	 */
	$(document).on("pageshow", "#sitemap", function() {
		$("div[data-role='campusmenu']").campusmenu("pageshow");

		$('#Terminals:checkbox').click(checkUncheck(terminals));
		$('#Institute:checkbox').click(checkUncheck(institutes));
		$('#Mensen:checkbox').click(checkUncheck(canteens));
		$('#Parking:checkbox').click(checkUncheck(parking));
		$('#AnInstitute:checkbox').click(checkUncheck(associateinstitutes));
		$('#Living:checkbox').click(checkUncheck(student));
		$('#Sport:checkbox').click(checkUncheck(sport));

		settings.initColors();
	});

	var CampusMapView = Backbone.View.extend({

		initialize: function () {
			this.listenToOnce(this.collection, "sync", this.render);
			this.listenTo(this.collection, "error", this.fetchFailed);
			this.collection.fetch();
		},

		fetchFailed: function(error) {
			new utils.ErrorView({el: '#error-placeholder', msg: 'Die Daten konnten nicht geladen werden.', module:'sitemap', err: error});
		},

		render: function() {
			var url = this.model.get("campus");

			this.$el.append("<div data-role='searchablemap'></div>");
			this.$el.trigger("create");

			this.$("div[data-role='searchablemap']").searchablemap({ categoryStore: categoryStore });
			this.$("div[data-role='searchablemap']").searchablemap("pageshow", url.center);

			// Add map objects
			this.$("div[data-role='searchablemap']").searchablemap("insertSFC", this.collection);

			// Set search value
			var search = this.model.get("search");
			if (search !== undefined) {
				$("div[data-role='searchablemap']").searchablemap("viewByName", search);
			}
		}
	});

	function drawSelectedCampus(options) {
		var uniqueDivId = _.uniqueId("id_");
		clearMenu(uniqueDivId);

		lastFinderId = uniqueDivId;
		lastCampus = options.campusName;

		var model = new models.Campus({
			campus: settings.getCampus(options.campusName),
			search: options.meta
		});
		var collection = new models.CampusMapCollection([], {
			geo: geo,
			campus: model.get("campus").campus,
			settings: settings
		});
		new CampusMapView({el: $("#" + uniqueDivId), collection: collection, model: model});
	}

	function clearMenu(uniqueDivId) {
		$("#currentCampus").empty().append("<div id=\"" + uniqueDivId + "\"></div>");
	}

	function CategoryStore() {

		var store = {};

		this.isVisible = function(category) {
			if (store[category] === undefined) {
				return true;
			}
			return store[category];
		};

		this.setVisibility = function(category, show) {
			store[category] = show;
		};
	}

	var SimilarLocationsView = Backbone.View.extend({

		events: {
			"click .similar-location": "navigateTo",
			"click .similar-locations-reset": "resetSitemap"
		},

		initialize: function() {
			this.template = rendertmpl("sitemap_similar_locations");
		},

		navigateTo: function(ev) {
			ev.preventDefault();
			var itemId = $(ev.currentTarget).attr("data-tag");
			sitemapNavigateTo(itemId);
		},

		resetSitemap: function(ev) {
			ev.preventDefault();
			sitemapReset();
		},

		render: function() {
			this.$el.empty();
			this.$el.append(this.template({similars: this.collection.toJSON()}));
			this.$el.trigger("create");
		}
	});

	function searchSimilarLocations(id) {
		var similars = new Backbone.Collection(geo.get(id).findSimilarLocations());
		var el =  $("#" + lastFinderId);

		new SimilarLocationsView({el: el, collection: similars}).render();
	}

	function sitemapReset() {
		$("div[data-role='campusmenu']").campusmenu("changeTo", lastCampus);
	}

	function sitemapNavigateTo(id) {
		var entry = geo.get(id);
		$("div[data-role='campusmenu']").campusmenu("changeTo", entry.get("campus"), entry.get("name"));
	}

	var geo = new models.SearchableGeoCollection();

	app.views.SitemapIndex = Backbone.View.extend({

		initialize: function(){
			this.template = rendertmpl('sitemap');
			this._loadMap();
		},

		_loadMap: function() {
			$.getScript('https://www.google.com/jsapi').done(function(){
				google.load('maps', '3', {other_params: 'sensor=false', callback: function(){
					settings.initCenters();
					oneSidedGuard.disableBlock();
				}});
			}).fail(function(){
				new utils.ErrorView({el: '#error-placeholder', msg: 'Es ist ein Fehler aufgetreten wahrscheinlich besteht keine Internetverbindung.', module:'sitemap'});
			});
		},

		render: function(){
			this.$el = this.page;
			this.$el.html(this.template({}));
			$("div[data-role='campusmenu']").campusmenu({ onChange: function(options) { oneSidedGuard.callMultiple(options); } }).campusmenu("pageshow");
			$('#sitemaps-settings').panel().trigger('create');
			return this;
		},
		afterRender: function(){
			$('#header-settings-btn').click(function(){
				$('#sitemaps-settings').panel("toggle");
			});
		},

		searchSimilarLocations: function(id) {
			searchSimilarLocations(id);
		}
	});


	app.views.SitemapPage = Backbone.View.extend({
		attributes: {"id": 'sitemap'},

		initialize: function(){
		},

		render: function(){
			$(this.el).html('');
			return this;
		}
	});

	return app.views; //SitemapPageView;
});