(function() {  
  var geocoder = new google.maps.Geocoder();
  var mapWidget = null;

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

  function createMapWidget(lat, lng) {
    var div = document.createElement("div");
    var latlng = new google.maps.LatLng(lat, lng);
    var map = new google.maps.Map(div, {zoom: 13, center: latlng, mapTypeId: google.maps.MapTypeId.ROADMAP, mapTypeControl: false});
    var marker = new google.maps.Marker({position: latlng, map: map, draggable: true});

    var searchBox = createSearchWidget();
    var buttons = createCancelChooseButtons();
    var autocomplete = new google.maps.places.Autocomplete(searchBox.$input);

    map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(buttons);
    map.controls[google.maps.ControlPosition.TOP_LEFT].push(searchBox);
    map.searchBox = searchBox;
    map.buttons = buttons;
    map.marker = marker;
    autocomplete.bindTo('bounds', map);

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

    return map;
  }

  function getMapWidget(lat, lng, formatted_address, callback) {
    if (!mapWidget)
      mapWidget = createMapWidget(lat, lng);
    else {
      var latlng = new google.maps.LatLng(lat, lng);
      mapWidget.marker.setPosition(latlng);
      mapWidget.panTo(latlng);
    }

    mapWidget.callback = callback;
    if (formatted_address) {
      mapWidget.searchBox.$input.value = formatted_address;
      mapWidget.buttons.$choose.disabled = false;
    } else {
      mapWidget.searchBox.$input.value = '';
      mapWidget.buttons.$choose.disabled = true;
    }

    return mapWidget;
  }

  function ChooseLocation(element, options) {
    if (!(this instanceof ChooseLocation))
      return new ChooseLocation(element, options);

    var self = this;

    this.result = null;
    this.setOptions(options);
    this.getStartPosition(function (result) {
      if (result) {
        self.result = result;
        if (self.options.onupdate)
          self.options.onupdate(self.result);
        self.showMap(element, result.latlng.lat, result.latlng.lng, result.address.formatted_address);
      } else
        self.showMap(element, self.options.defaultLat, self.options.defaultLng);
    });
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

    var street_number = extract(place, 'street_number');
    if (street_number) street_number = street_number + ' ';

    result.latlng = {lat: place.geometry.location.lat(), lng: place.geometry.location.lng()};
    result.address = {};
    result.address.formatted_address = place.formatted_address;
    result.address.city = extract(place, 'sublocality') || extract(place, 'locality') || extract(place, 'administrative_area_level_3') || extract(place, 'administrative_area_level_2');
    result.address.state = extract(place, 'administrative_area_level_1', 'short_name');
    result.address.country = extract(place, 'country', 'short_name');
    result.address.zipcode = extract(place, 'postal_code');
    result.address.street_address = extract(place, 'street_address') || street_number + extract(place, 'route');

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
    width: 'inherit',
    height: 'inherit',
    onupdate: null,
    oncancel: null,
    onchoose: null
  };

  ChooseLocation.prototype = {
    showMap: function (element, lat, lng, address) {
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

      var mapDiv = getMapWidget(lat, lng, address, callback).getDiv();
      mapDiv.style.width = this.options.width;
      mapDiv.style.height = this.options.height;

      while (element.firstChild)
        element.removeChild(element.firstChild);
      element.appendChild(mapDiv);
    },

    getStartPosition: function(callback) {
      if (this.options.lat && this.options.lng || this.options.address || !this.options.autoLocate || !navigator.geolocation) {
        if (this.options.address) {
          ChooseLocation.geocode(this.options.address, function (result) {
            callback(result);
          });
        } else {
          ChooseLocation.reverseGeocode(this.options.lat || this.options.defaultLat, this.options.lng || this.options.defaultLng, function (result) {
            callback(result);
          });
        }
      } else {
        navigator.geolocation.getCurrentPosition(function (pos) {
          ChooseLocation.reverseGeocode(pos.coords.latitude, pos.coords.longitude, function (result) {
            callback(result);
          });
        }, function () {
          callback(null);
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
