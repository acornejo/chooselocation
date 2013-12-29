(function() {  
  function createSearchWidget() {
    var container, input, button, button_icon;
    
    container = document.createElement("form");
    container.id = "map-search";

    input = document.createElement("input");
    input.type = "text";
    input.id = "map-search-input";
    input.className = "map-search";
    input.placeholder = "Search";

    button = document.createElement("button");
    button.id = "map-search-button";

    container.appendChild(input);
    container.appendChild(button);
    container.$input = input;
    container.$button = button;

    return container;
  }

  function createCancelChooseButtons() {
    var container, cancel, choose;

    container = document.createElement("div");
    container.id = "map-buttons";

    cancel = document.createElement("button");
    cancel.id = "map-cancel-button";
    cancel.appendChild(document.createTextNode("Cancel"));

    choose = document.createElement("button");
    choose.id = "map-choose-button";
    choose.appendChild(document.createTextNode("Choose"));

    container.appendChild(cancel);
    container.appendChild(choose);

    container.$cancel = cancel;
    container.$choose = choose;

    return container;
  }

  function createMapWidget(element, lat, lng, formatted_address, callback) {
    var latlng = new google.maps.LatLng(lat, lng);
    var map = new google.maps.Map(element, {zoom: 13, center: latlng, mapTypeId: google.maps.MapTypeId.ROADMAP, mapTypeControl: false});
    var marker = new google.maps.Marker({position: latlng, map: map, draggable: true});

    var searchBox = createSearchWidget();
    var buttons = createCancelChooseButtons();
    var autocomplete = new google.maps.places.Autocomplete(searchBox.$input);

    map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(buttons);
    map.controls[google.maps.ControlPosition.TOP_LEFT].push(searchBox);
    map.searchBox = searchBox;
    map.buttons = buttons;
    autocomplete.bindTo('bounds', map);

    map.callback = callback;
    if (formatted_address) {
      map.searchBox.$input.value = formatted_address;
      map.buttons.$choose.disabled = false;
    } else {
      map.searchBox.$input.value = '';
      map.buttons.$choose.disabled = true;
    }

    searchBox.onsubmit = function (e) {
      e.preventDefault();
      if (searchBox.$input.value.length >= 2)
        ChooseLocation.geocode(searchBox.$input.value, updatePosition);
      return false;
    };

    buttons.$cancel.onclick = function (e) {
      e.preventDefault();
      map.callback(null, 'cancel');
      return false;
    };

    buttons.$choose.onclick = function (e) {
      e.preventDefault();
      map.callback(null, 'choose');
      return false;
    };

    function updatePosition(result, place) {
      if (place.geometry.viewport) 
        map.panToBounds(place.geometry.viewport);
       else
        map.panTo(place.geometry.location);
      marker.setPosition(place.geometry.location);
      buttons.$choose.disabled = false;
      searchBox.$input.value = place.formatted_address;
      map.callback(result, 'update');
    }

    google.maps.event.addListener(marker, 'dragend', function (event) {
      ChooseLocation.reverseGeocode(event.latLng.lat(), event.latLng.lng(), updatePosition);
    });

    google.maps.event.addListener(marker, 'click', function (event) {
      map.panTo(marker.getPosition());
    });

    google.maps.event.addListener(map, 'click', function (event) {
      marker.setPosition(event.latLng);
      ChooseLocation.reverseGeocode(event.latLng.lat(), event.latLng.lng(), updatePosition);
    });

    google.maps.event.addListener(autocomplete, 'place_changed', function() {
      var place = autocomplete.getPlace();
      if (place.geometry)
        updatePosition(ChooseLocation.parseResult(place), place);
    });

    setTimeout(function () {
      google.maps.event.trigger(map, 'resize');
      map.panTo(marker.getPosition());
    }, 500);
  }

  var geocoder = new google.maps.Geocoder();

  function ChooseLocation(element, options) {
    if (!(this instanceof ChooseLocation))
      return new ChooseLocation(element, options);

    this.result = null;
    this.setOptions(options);
    this.showMap(element);
  }

  ChooseLocation.geocode = function (address, fn) {
    geocoder.geocode({address: address}, function (results, status) {
      if (status === google.maps.GeocoderStatus.OK)
        fn(ChooseLocation.parseResult(results[0]), results[0]);
    });
  };

  ChooseLocation.reverseGeocode = function (lat, lng, fn) {
    geocoder.geocode({latLng: new google.maps.LatLng(lat, lng)}, function(results, status) {
      if (status === google.maps.GeocoderStatus.OK)
        fn(ChooseLocation.parseResult(results[0]), results[0]);
    });
  };

  ChooseLocation.parseResult = function (place) {
    var result = {}, i, j;

    if (!place.geometry)
      return;

    result.latlng = {lat: place.geometry.location.lat(), lng: place.geometry.location.lng()};
    result.address = {};
    result.address.formatted_address = place.formatted_address;
    result.address.city = extract(place, 'sublocality') || extract(place, 'locality') || extract(place, 'administrative_area_level_3') || extract(place, 'administrative_area_level_2');
    result.address.state = extract(place, 'administrative_area_level_1', 'short_name');
    result.address.country = extract(place, 'country', 'short_name');
    result.address.zipcode = extract(place, 'postal_code');
    result.address.street_address = extract(place, 'street_address') || extract(place, 'street_number') + extract(place, 'route');

    function extract(place, type, name) {
      if (!name) name = 'long_name';

      var i, j;
      for (i = 0; i<place.address_components.length; i++) {
        if (place.address_components[i].types === type)
          return place.address_components[i][name];
        else {
          for (j = 0; j<place.address_components[i].types.length; j++)
            if (place.address_components[i].types[j] === type)
              return place.address_components[i][name];
        }
      }
      return '';
    }

    return result;
  };

  ChooseLocation.defaultOptions = {
    lat: null,
    lng: null,
    address: null,
    autoLocate: true,
    defaultLat: 42.3584308, 
    defaultLng: -71.0597732,
    onupdate: null,
    oncancel: null,
    onchoose: null
  };

  ChooseLocation.prototype = {
    showMap: function (element) {
      var self = this;

      function callback(result, action) {
        if (action === 'update') {
          self.result = result;
          if (self.options.onupdate)
            self.options.onupdate(self.result);
        } else if (action === 'cancel') {
          if (self.options.oncancel)
            self.options.oncancel();
        } else if (action === 'choose') {
          if (self.options.onchoose)
            self.options.onchoose(self.result);
        }
      }

      if (self.options.lat && self.options.lng || self.options.address || !self.options.autoLocate || !navigator.geolocation) {
        if (self.options.address) {
          ChooseLocation.geocode(self.options.address, function (result, place) {
            callback(result, 'update');
            createMapWidget(element, result.latlng.lat, result.latlng.lng, result.address.formatted_address, callback);
          });
        } else {
          ChooseLocation.reverseGeocode(self.options.lat || self.options.defaultLat, self.options.lng || self.options.defaultLng, function (result, place) {
            callback(result, 'update');
            createMapWidget(element, result.latlng.lat, result.latlng.lng, result.address.formatted_address, callback);
          });
        }
      } else {
        navigator.geolocation.getCurrentPosition(function (pos) {
          ChooseLocation.reverseGeocode(pos.coords.latitude, pos.coords.longitude, function (result, place) {
            callback(result, 'update');
            createMapWidget(element, result.latlng.lat, result.latlng.lng, result.address.formatted_address, callback);
          });
        }, function () {
          createMapWidget(element, self.options.defaultLat, self.options.defaultLng, null, callback);
        });
      }
    },

    setOptions: function (options) {
      this.options = options || {};
      for (var p in ChooseLocation.defaultOptions)
        if (!this.options.hasOwnProperty(p))
          this.options[p] = ChooseLocation.defaultOptions[p];
    }
  };

  if (typeof require === "function" && typeof exports === "object" && typeof module === "object") 
    module.exports = ChooseLocation;
  else if (typeof define === "function" && define.amd) 
    define(function () { return ChooseLocation; });
  else
    window.ChooseLocation = ChooseLocation;

})();
