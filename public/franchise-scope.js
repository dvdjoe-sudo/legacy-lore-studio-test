import {FRANCHISE_DATA} from './data-import.js';
export const SCOPE_VARIANTS={
 LAD:[['franchise','Brooklyn + Los Angeles',1884,2100],['brooklyn','Brooklyn Dodgers',1884,1957],['losangeles','Los Angeles Dodgers',1958,2100]],
 WSH:[['franchise','Montreal Expos + Washington Nationals',1969,2100],['expos','Montreal Expos',1969,2004],['washington','Washington Nationals',2005,2100]],
 ATH:[['oakland','Oakland Athletics',1968,2024],['franchise','Athletics · all franchise cities',1901,2100],['philadelphia','Philadelphia Athletics',1901,1954],['kansascity','Kansas City Athletics',1955,1967],['athletics','Athletics · 2025 onward',2025,2100]],
 SF:[['franchise','New York + San Francisco Giants',1883,2100],['newyork','New York Giants',1883,1957],['sanfrancisco','San Francisco Giants',1958,2100]],
 ATL:[['franchise','Braves · all franchise cities',1876,2100],['boston','Boston Braves',1876,1952],['milwaukee','Milwaukee Braves',1953,1965],['atlanta','Atlanta Braves',1966,2100]],
 MIN:[['franchise','Washington Senators + Minnesota Twins',1901,2100],['minnesota','Minnesota Twins',1961,2100],['senators','Washington Senators',1901,1960]],
 TEX:[['franchise','Washington Senators + Texas Rangers',1961,2100],['texas','Texas Rangers',1972,2100],['senators','Washington Senators',1961,1971]],
 BAL:[['franchise','Baltimore Orioles only · no Browns',1954,2100]],
 MIL:[['franchise','Seattle Pilots + Milwaukee Brewers',1969,2100],['milwaukee','Milwaukee Brewers',1970,2100]],
};
export function scopes(team,name=team){return SCOPE_VARIANTS[team]||[['franchise',name,FRANCHISE_DATA[team][2],2100]];}
export function effectiveScope(team,studio={},name=team){const options=scopes(team,name);const selected=team==='ATH'&&studio.scopeKey==='franchise'&&studio.from===null?options[0]:options.find(v=>v[0]===studio.scopeKey)||options[0];return {key:selected[0],name:selected[1],from:studio.from??selected[2],to:Math.min(studio.to??selected[3],new Date().getFullYear()),teamId:FRANCHISE_DATA[team][0]};}
