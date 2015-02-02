// Register for an API key at http://openweathermap.org/appid
// and enter the key below.
var OPEN_WEATHER_MAP_API_KEY = "INSERT_OPEN_WEATHER_MAP_API_KEY_HERE";

// Create a copy of http://goo.gl/SNE5H7 and enter the URL below.
var SPREADSHEET_URL = 'INSERT_SPREADSHEET_URL_HERE';

// A cache to store the weather for locations already lookedup earlier.
var WEATHER_LOOKUP_CACHE = {};


/**
 * The code to execute when running the script.
 */
function main() {
  // Load data from spreadsheet.
  var spreadsheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
  var campaignRuleData = getSheetData(spreadsheet, 1);
  var weatherConditionData = getSheetData(spreadsheet, 2);
  var geoMappingData = getSheetData(spreadsheet, 3);

  // Convert the data into dictionaries for convenient usage.
  var campaignMapping = buildCampaignRulesMapping(campaignRuleData);
  var weatherConditionMapping =
      buildWeatherConditionMapping(weatherConditionData);
  var locationMapping = buildLocationMapping(geoMappingData);

  // Apply the rules.
  for (var campaignName in campaignMapping) {
    applyRulesForCampaign(campaignName, campaignMapping[campaignName],
        locationMapping, weatherConditionMapping);
  }
}

/**
 * Retrieves the data for a worksheet.
 * @param {Object} spreadsheet The spreadsheet.
 * @param {number} sheetIndex The sheet index.
 * @return {Array} The data as a two dimensional array.
 */
function getSheetData(spreadsheet, sheetIndex) {
  var sheet = spreadsheet.getSheets()[sheetIndex];
  var range =
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
  return range.getValues();
}

/**
 * Builds a mapping between the list of campaigns and the rules
 * being applied to them.
 * @param {Array} campaignRulesData The campaign rules data, from the
 *     spreadsheet.
 * @return {Object.<string, Array.<Object>> } A map, with key as campaign name,
 *     and value as an array of rules that apply to this campaign.
 */
function buildCampaignRulesMapping(campaignRulesData) {
  var campaignMapping = {};
  for (var i = 0; i < campaignRulesData.length; i++) {
    // Skip rule if not enabled.

    if (campaignRulesData[i][4].toLowerCase() == 'yes') {
      var campaignName = campaignRulesData[i][0];
      var campaignRules = campaignMapping[campaignName] || [];
      campaignRules.push({
          'name': campaignName,

          // location for which this rule applies.
          'location': campaignRulesData[i][1],

          // the weather condition (e.g. Sunny)
          'condition': campaignRulesData[i][2],

          // bid modifier to be applied.
          'bidModifier': campaignRulesData[i][3]
      });
      campaignMapping[campaignName] = campaignRules;
    }
  }
  Logger.log('Campaign Mapping: %s', campaignMapping);
  return campaignMapping;
}

/**
 * Builds a mapping between a weather condition name (e.g. Sunny) and the rules
 * that correspond to that weather condition.
 * @param {Array} weatherConditionData The weather condition data from the
 *      spreadsheet.
 * @return {Object.<string, Array.<Object>>} A map, with key as a weather
 *     condition name, and value as the set of rules corresponding to that
 *     weather condition.
 */
function buildWeatherConditionMapping(weatherConditionData) {
  var weatherConditionMapping = {};

  for (var i = 0; i < weatherConditionData.length; i++) {
    var weatherConditionName = weatherConditionData[i][0];
    weatherConditionMapping[weatherConditionName] = {
      // Condition name (e.g. Sunny)
      'condition': weatherConditionName,

      // Temperature (e.g. 50 to 70)
      'temperature': weatherConditionData[i][1],

      // Precipitation (e.g. below 70)
      'precipitation': weatherConditionData[i][2],

      // Wind speed (e.g. above 5)
      'wind': weatherConditionData[i][3]
    };
  }
  Logger.log('Weather condition mapping: %s', weatherConditionMapping);
  return weatherConditionMapping;
}

/**
 * Builds a mapping between a location name (as understood by OpenWeatherMap
 * API) and a list of geo codes as identified by AdWords scripts.
 * @param {Array} geoTargetData The geo target data from the spreadsheet.
 * @return {Object.<string, Array.<Object>>} A map, with key as a locaton name,
 *     and value as an array of geo codes that correspond to that location
 *     name.
 */
function buildLocationMapping(geoTargetData) {
  var locationMapping = {};
  for (var i = 0; i < geoTargetData.length; i++) {
    var locationName = geoTargetData[i][0];
    var locationDetails = locationMapping[locationName] || {
      'geoCodes': []      // List of geo codes understood by AdWords scripts.
    };

    locationDetails.geoCodes.push(geoTargetData[i][1]);
    locationMapping[locationName] = locationDetails;
  }
  Logger.log('Location Mapping: %s', locationMapping);
  return locationMapping;
}

/**
 * Applies rules to a campaign.
 * @param {string} campaignName The name of the campaign.
 * @param {Object} campaignRules The details of the campaign. See
 *     buildCampaignMapping for details.
 * @param {Object} locationMapping Mapping between a location name (as
 *     understood by OpenWeatherMap API) and a list of geo codes as
 *     identified by AdWords scripts. See buildLocationMapping for details.
 * @param {Object} weatherConditionMapping Mapping between a weather condition
 *     name (e.g. Sunny) and the rules that correspond to that weather
 *     condition. See buildWeatherConditionMapping for details.
 */
function applyRulesForCampaign(campaignName, campaignRules, locationMapping,
                               weatherConditionMapping) {
  for (var i = 0; i < campaignRules.length; i++) {
    var bidModifier = 1;
    var campaignRule = campaignRules[i];

    // Get the weather for the required location.
    var locationDetails = locationMapping[campaignRule.location];
    var weather = getWeather(campaignRule.location);
    Logger.log('Weather for %s: %s', locationDetails, weather);

    // Get the weather rules to be checked.
    var weatherConditionName = campaignRule.condition;
    var weatherConditionRules = weatherConditionMapping[weatherConditionName];

    // Evaluate the weather rules.
    if (evaluateWeatherRules(weatherConditionRules, weather)) {
      Logger.log('Matching Rule found: Campaign Name = %s, location = %s, ' +
          'weatherName = %s,weatherRules = %s, noticed weather = %s.',
          campaignRule.name, campaignRule.location,
          weatherConditionName, weatherConditionRules, weather);
      bidModifier = campaignRule.bidModifier;
      adjustBids(campaignName, locationDetails.geoCodes, bidModifier);
    }
  }
  return;
}

/**
 * Converts a temperature value from kelvin to fahrenheit.
 * @param {number} kelvin The temperature in Kelvin scale.
 * @return {number} The temperature in Fahrenheit scale.
 */
function toFahrenheit(kelvin) {
  return (kelvin - 273.15) * 1.8 + 32;
}

/**
 * Evaluates the weather rules.
 * @param {Object} weatherRules The weather rules to be evaluated.
 * @param {Object.<string, string>} weather The actual weather.
 * @return {boolean} True if the rule matches current weather conditions,
 *     False otherwise.
 */
function evaluateWeatherRules(weatherRules, weather) {
  // See http://bugs.openweathermap.org/projects/api/wiki/Weather_Data
  // for values returned by OpenWeatherMap API.
  var mm_to_inches = 0.0393701;
  var precipitation = [];
  var days_forecasted = 7;
  var temperature = [];
  var windspeed = [];
  var cloudiness = [];
  for(var i=0;i<days_forecasted;i++)
  {
    if (weather.list[i].rain) {
      precipitation[i] = weather.list[i].weather.rain*mm_to_inches;
    }
    temperature[i]= toFahrenheit(weather.list[i].temp.day);
    windspeed[i] = weather.list[i].wind.speed;
    cloudiness[i] = weather.list[i].clouds;
  }


  return evaluateMatchRules(weatherRules.temperature, temperature) &&
      evaluateMatchRules(weatherRules.precipitation, precipitation) &&
      evaluateMatchRules(weatherRules.wind, windspeed);
}

/**
 * Evaluates a condition for a value against a set of known evaluation rules.
 * @param {string} condition The condition to be checked.
 * @param {Object} value The value to be checked.
 * @return {boolean} True if an evaluation rule matches, false otherwise.
 */
function evaluateMatchRules(condition, value) {
  // No condition to evaluate, rule passes.
  if (condition == '') {
    return true;
  }
  var rules = [matchesBelow, matchesAbove, matchesRange];

  for (var i = 0; i < rules.length; i++) {
    if (rules[i](condition, value)) {
      return true;
    }
  }
  return false;
}

/**
 * Evaluates whether a value is below a threshold value.
 * @param {string} condition The condition to be checked. (e.g. below 50).
 * @param {number} value The value to be checked.
 * @return {boolean} True if the value is less than what is specified in
 * condition, false otherwise.
 */
function matchesBelow(condition, value) {
  conditionParts = condition.split(' ');

  if (conditionParts.length != 2) {
    return false;
  }

  if (conditionParts[0] != 'below') {
    return false;
  }

  if (value < conditionParts[1]) {
    return true;
  }
  return false;
}

/**
 * Evaluates whether a value is above a threshold value.
 * @param {string} condition The condition to be checked. (e.g. above 50).
 * @param {number} value The value to be checked.
 * @return {boolean} True if the value is greater than what is specified in
 *     condition, false otherwise.
 */
function matchesAbove(condition, value) {
  conditionParts = condition.split(' ');

  if (conditionParts.length != 2) {
    return false;
  }

  if (conditionParts[0] != 'above') {
    return false;
  }

  if (value > conditionParts[1]) {
    return true;
  }
  return false;
}

/**
 * Evaluates whether a value is within a range of values.
 * @param {string} condition The condition to be checked (e.g. 5 to 18).
 * @param {number} value The value to be checked.
 * @return {boolean} True if the value is in the desired range, false otherwise.
 */
function matchesRange(condition, value) {
  conditionParts = condition.replace('\w+', ' ').split(' ');

  if (conditionParts.length != 3) {
    return false;
  }

  if (conditionParts[1] != 'to') {
    return false;
  }

  if (conditionParts[0] <= value && value <= conditionParts[2]) {
    return true;
  }
  return false;
}

/**
 * Retrieves the weather for a given location, using the OpenWeatherMap API.
 * @param {string} location The location to get the weather for.
 * @return {Object.<string, string>} The weather attributes and values, as
 *     defined in the API.
 */
function getWeather(location) {
  if (location in WEATHER_LOOKUP_CACHE) {
    Logger.log('Cache hit...');
    return WEATHER_LOOKUP_CACHE[location];
  }

  var url = Utilities.formatString(
      'http://api.openweathermap.org/data/2.5/weather?APPID=%s&q=%s',
      encodeURIComponent(OPEN_WEATHER_MAP_API_KEY),
      encodeURIComponent(location));
  var response = UrlFetchApp.fetch(url);
  if (response.getResponseCode() != 200) {
    throw Utilities.formatString(
        'Error returned by API: %s, Location searched: %s.',
        response.getContentText(), location);
  }

  var result = JSON.parse(response.getContentText());

  // OpenWeatherMap's way of returning errors.
  if (result.cod != 200) {
    throw Utilities.formatString(
        'Error returned by API: %s,  Location searched: %s.',
        response.getContentText(), location);
  }

  WEATHER_LOOKUP_CACHE[location] = result;
  return result;
}

/**
 * Adjusts the bidModifier for a list of geo codes for a campaign.
 * @param {string} campaignName The name of the campaign.
 * @param {Array} geocodes The list of geo codes for which bids should be
 *     adjusted.
 * @param {number} bidModifier The bid modifier to use.
 */
function adjustBids(campaignName, geocodes, bidModifier) {
  // Get the campaign.
  var campaignIterator = AdWordsApp.campaigns().withCondition(
      Utilities.formatString('CampaignName = "%s"', campaignName)).get();
  while (campaignIterator.hasNext()) {
    var campaign = campaignIterator.next();

    // Get the targeted locations.
    var locations = campaign.targeting().targetedLocations().get();
    while (locations.hasNext()) {
      var location = locations.next();
      var currentBidModifier = location.getBidModifier().toFixed(2);

      // Apply the bid modifier only if the campaign has a custom targeting
      // for this geo location.
      if (geocodes.indexOf(location.getId()) != -1 &&
          currentBidModifier != bidModifier) {
        Logger.log('Setting bidModifier = %s for campaign name = %s, ' +
            'geoCode = %s. Old bid modifier is %s.', bidModifier, campaignName,
            location.getId(), currentBidModifier);
        location.setBidModifier(bidModifier);
      }
    }
  }
}