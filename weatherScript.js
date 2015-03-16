// Register for an API key at http://openweathermap.org/appid
// and enter the key below.
var OPEN_WEATHER_MAP_API_KEY = "f0297e9f8e4573d5641bb8720bfafa0e";
//var Logger = Logger;
// Create a copy of http://goo.gl/SNE5H7 and enter the URL below.
var SPREADSHEET_URL = 'https://docs.google.com/a/searchinfluence.com/spreadsheet/ccc?key=0All7Ng2pAyH8dFphTzczSHFkS1Bza29HeXJ3VjVsNnc';

// A cache to store the weather for locations already lookedup earlier.
var WEATHER_LOOKUP_CACHE = {};
var DAYS_FORECAST =  7;
//this is a list of all the acceptable weather codes according to the open weather map api
var weatherConditionList = ["200","201","202","210","211","212","221","230","231","232","300","301","302","310","311","312","313","314","321","500","501","502","503","504","511","520","521","522","531","600","601","602","611","612","615","616","620","621","622","701","711","721","731","741","751","761","762","771","781","800","801","802","803","804","900","901","902","903","904","905","906","951","952","953","954","955","956","957","958","959","960","961","962"];
var COUNTER=0;
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
  var weatherConditionMapping = buildWeatherConditionMapping(weatherConditionData);
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
function buildCampaignRulesMapping(campaignRulesData, geoMappingData) {
  var campaignMapping = {};
  for (var i = 0; i < campaignRulesData.length; i++) {     
    // Skip rule if not enabled.

    if (campaignRulesData[i][4].toLowerCase() == 'yes') {
      var campaignName = campaignRulesData[i][0];
      var campaignRules = campaignMapping[campaignName] || [];
      campaignRules.push({
          'name': campaignName,

          // location for which this rule applies.
          'location': 4335045,

          // the weather condition (e.g. Sunny)
          'condition': campaignRulesData[i][2],

          // bid modifier to be applied.
          'bidModifier': campaignRulesData[i][3]
      });
      campaignMapping[campaignName] = campaignRules;
    }
  }
  //Logger.log('Campaign Mapping: %s', campaignMapping);
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

  for (var i = 1; i < weatherConditionData.length; i++) {
    var weatherConditionName = weatherConditionData[i][0];
    weatherConditionMapping[weatherConditionName] = {
      // Condition name (e.g. Sunny)
      'condition': String(weatherConditionName),

      // Temperature (e.g. 50 to 70)
      'temperature': String(weatherConditionData[i][1]),

      // Precipitation (e.g. below 70)
      'precipitation': weatherConditionData[i][2],

      // Wind speed (e.g. above 5)
      'wind': String(weatherConditionData[i][3]),
      
      // Days in the Future to look to
      'daysInFuture' : Math.round(weatherConditionData[i][4]),//parseInt(weatherConditionData[i][4]),
      
      // Weather codes that make up this condition
      'WeatherCode' : String(weatherConditionData[i][5]),
      
      //Stopping time for the condition test
      'StoppingTime' : String(weatherConditionData[i][6])
    };
    


  }
  //Logger.log('Weather condition mapping: %s', weatherConditionMapping);
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
  //Logger.log('Location Mapping: %s', locationMapping);
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
  //Logger.log("Number of Rules " + campaignRules.length);
  for (var i = 0; i < campaignRules.length; i++) {
    var bidModifier = 1;
    var campaignRule = campaignRules[i];

    // Get the weather for the required location.
    var locationDetails = locationMapping[campaignRule.location];
    var weather = getWeather(campaignRule.location);
    //Logger.log('Weather for %s: %s', locationDetails, weather);

    // Get the weather rules to be checked.
    var weatherConditionName = campaignRule.condition;
    var weatherConditionRules = weatherConditionMapping[weatherConditionName];
    
    for(var key in weatherConditionRules) {
      var value = weatherConditionRules[key];
      //Logger.log(key + " : " + value + " vs actual " + " "  )
      
  }//Logger.log(COUNTER++ + "\n================================================================")
  // Evaluate the weather rules.
    if (evaluateWeatherRules(weatherConditionRules, weather)) {
      Logger.log('Matching Rule found: Campaign Name = %s, location = %s, ' +
          'weatherName = %s,weatherRules = %s, noticed weather = %s.',
          campaignRule.name, campaignRule.location,
          weatherConditionName, weatherConditionRules, weather);
      //Set bid modifier as off for the weather condition to pause for that condition

        bidModifier = campaignRule.bidModifier;
        Logger.log(bidModifier)
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
  var precipitation = [];
  var weatherValue = "";
  var temperature = [];
  var windspeed = [];
  var cloudiness = [];
  var matchesRule = false;

  if ( ruleIsEnabled(weatherRules) &&  beforeStoppingTime(weatherRules.StoppingTime)) {
    
    if ((typeof weatherRules.daysInFuture === undefined) || (weatherRules.hasOwnProperty('daysInFuture')===false)) {
      weatherRules.daysInFuture = 0;
    }
    for(var i=weatherRules.daysInFuture;i<=weatherRules.daysInFuture && i < weather.list.length;i++)
    {
      Logger.log("Days in the Future: " + i)
      if (weather.list[i].weather[0].main.toLowerCase().indexOf('rain') != -1) {
        precipitation[i] = 1;
      }else{
        precipitation[i] = 0; //0;
      }
      temperature[i]= toFahrenheit(weather.list[i].temp['day']);
      Logger.log("temp "+toFahrenheit(weather.list[i].temp['day']))
      windspeed[i] = weather.list[i].speed.toFixed(2);
      Logger.log("wind "+weather.list[i].speed.toFixed(2))
      cloudiness[i] = weather.list[i].clouds;
      Logger.log("Cloud "+weather.list[i].clouds)
      weatherCode = weather.list[i].weather[0].id.toString();
      Logger.log(" Weather Code "+ weather.list[i].weather[0].id.toString())
      if ( evaluateMatchRules(weatherRules.temperature, temperature[i])
          //&& evaluateMatchRules(weatherRules.precipitation, precipitation[i])
          //&& evaluateMatchRules(weatherRules.wind, windspeed[i])
          && evaluateMatchRules(weatherRules.WeatherCode, weatherCode)){
          matchesRule=true;
          break;
        }//end if
  
    }//end for
    
  }return matchesRule;
}

/**
 * If rule is enable run the loop
 **/
function ruleIsEnabled(weatherRules){
 return weatherRules != null;  
}

/**
 * Compares Stopping time to actual time and if after time then don't run the rule
 * @param {string} stopping time with am or pm appended.
 **/
function beforeStoppingTime(stoppingTime) {
  var realTime = new Date().getHours() + 2;

  if (stoppingTime === undefined){
    return true;
  }
  else if(stoppingTime.indexOf('pm') != -1)
  {
    stoppingTime = stoppingTime.replace(/pm/ig, '')
    if (stoppingTime != 12)
    {
      stoppingTime = parseInt(stoppingTime) + 12
    }    
  }
  else if (stoppingTime.indexOf('am') != -1)
  {
    stoppingTime = stoppingTime.replace(/am/ig, '')
    stoppingTime = parseInt(stoppingTime) ;
    if (stoppingTime === 12) {
      stoppingTime = 24;
    }
 
  }
  Logger.log("Real time: " + realTime + " Stopping Time: " + stoppingTime + " " + (realTime < stoppingTime))
  return realTime < stoppingTime;
  
}
/**
 * Evaluates a condition for a value against a set of known evaluation rules.
 * @param {string} condition The condition to be checked.
 * @param {Object} value The value to be checked.
 * @return {boolean} True if an evaluation rule matches, false otherwise.
 */
function evaluateMatchRules(condition, value) {
  // No condition to evaluate, rule passes.
  if (condition == '' || condition == null || condition == ' ') {
    return true;
  }
  var rules = [matchesBelow, matchesAbove, matchesRange, matchesList, matchesNotList];

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
  if (condition.indexOf('not') === -1 )
  {
    
    //Logger.log('Inside MatchesBelow')
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
  if (condition.indexOf('not') === -1 )
  {
    //Logger.log('Inside MatchesAbove')
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
  if (condition.indexOf('not') === -1 )
  {
    //Logger.log('Inside MatchesRange')
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
  }

return false;
}


/**
 *Evaluates whether a value is within the list of rainy values set
 * @param {string} condition The condition to be checked (501,502,800).
 * @param {string } value a string of comma seperated numbers that should be matched.
 * @return {boolean} True if the value is in the desired range, false otherwise.
 *
 */
function matchesList(condition, value){
  if (condition.indexOf('not') === -1  )
  {
    Logger.log(condition)
    condition = condition.replace(/\s/,'' )
    conditionParts = condition.split(',');
    for(var i=0;i<conditionParts.length;i++){
      for(var j=0;j<weatherConditionList.length;j++){
        if (conditionParts[i] === weatherConditionList[j] && value === weatherConditionList[j]) {
          Logger.log('Matches List: ' + conditionParts[i])
          return true;
        }
      }
    }
    
  }
  
  return false;
  
}

/**
 *Evaluates whether a value is NOT within the list of values set
 * @param {string} condition The condition to be checked (not 501,502,800).
 * @param {string} value  A string of comma seperated numbers that shouldn't match.
 * @return {boolean} True if the value is in the desired range, false otherwise.
 *
 */
function matchesNotList(condition, value){
  if (condition.indexOf('not') > -1 ) {
    Logger.log("Not " + condition)
    condition = condition.replace(/not/ig,'' ); 
    condition = condition.replace(/\s/,'' )
    conditionParts = condition.split(',');
    for(var i=0;i<conditionParts.length;i++){
      for(var j=0;j<weatherConditionList.length;j++){
        if (conditionParts[i] === weatherConditionList[j] && value === weatherConditionList[j]) {
          Logger.log('Matches Not List: ' + conditionParts[i])
          return false;
        }
      }
    }
    Logger.log("returning true for the not list")
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
    //Logger.log('Cache hit...');
    return WEATHER_LOOKUP_CACHE[location];
  }

  var url = Utilities.formatString(
      'http://api.openweathermap.org/data/2.5/forecast/daily?APPID=%s&id=%s&cnt=%s',
      encodeURIComponent(OPEN_WEATHER_MAP_API_KEY),
      encodeURIComponent(location),
      DAYS_FORECAST );
  Logger.log("URL = "+url)
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
  var campaignIterator = AdWordsApp.campaigns().withCondition(Utilities.formatString('CampaignName = "%s"', campaignName)).get();
  //Logger.log("inside of adjust bids")
  while (campaignIterator.hasNext()) {
    var campaign = campaignIterator.next();
    // Get the targeted locations.
    var locations = campaign.targeting().targetedLocations().get();
    //Logger.log("locations: " +locations);
    while (locations.hasNext()) {
      var location = locations.next();
      var currentBidModifier = location.getBidModifier().toFixed(2);
      //Logger.log("more inside of adjust bids")
      // Apply the bid modifier only if the campaign has a custom targeting
      // for this geo location.

      if (geocodes.indexOf(location.getId()) != -1
          /*&& currentBidModifier != bidModifier*/) {
        Logger.log('Setting bidModifier = %s for campaign name = %s, ' +
            'geoCode = %s. Old bid modifier is %s.', bidModifier, campaignName,
            location.getId(), currentBidModifier);
        
        /*if the bidmodifier is set to negative 1 then it will pause the campaign
         *if the campaign is already paused and the bidmodifier isn't negative it starts the
         *campaign again
         */
        Logger.log("bidmodifier set to "+ bidModifier)
        campaign.enable();
        location.setBidModifier(bidModifier);
        Logger.log("bidmodifier set to "+ bidModifier)
        if(bidModifier == -1){
          campaign.pause();
        }
        
      }
    }
  }
}