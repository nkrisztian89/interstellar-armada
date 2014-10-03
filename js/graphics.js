/**
 * @fileOverview This file contains the classes to load graphics configuration
 * and set up an according graphics context to use in the game.
 * @author <a href="mailto:nkrisztian89@gmail.com">Krisztián Nagy</a>
 * @version 0.1
 */

/**********************************************************************
    Copyright 2014 Krisztián Nagy
    
    This file is part of Interstellar Armada.

    Interstellar Armada is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    Interstellar Armada is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Interstellar Armada.  If not, see <http://www.gnu.org/licenses/>.
 ***********************************************************************/

/**
 * Creates a new LOD context object.
 * @class Holds a certain LOD configuration to be used for making LOD decisions while rendering.
 * @param {number} maxEnabledLOD The highest LOD that can be chosen while rendering.
 * @param {number[]} thresholds The threshold size in pixels for each LOD.
 * For each object the highest LOD, for which its size exceed the threshold, will be used.
 */
function LODContext(maxEnabledLOD,thresholds) {
	this.maxEnabledLOD=maxEnabledLOD;
	this.thresholds=thresholds;
}

/**
 * Creates a new graphics context object.
 * @class A graphics context for other modules, to be used to pass the 
 * important properties of the current graphics environment to functions that
 * can manipulate it.
 */
function GraphicsContext() {
    this.resourceCenter=new ResourceCenter();
    
    this._antialiasing = false;
    
    this._maxLoadedLOD = null;
    this._lodContext = null;
    
    // temporary test variable indicating whether the direction of directional
    // lighting should keep turning around
    this.lightIsTurning=false;
}

GraphicsContext.prototype.loadFromXML = function(xmlSource) {
    var i;
    
    this.resourceCenter.requestShaderLoad(xmlSource.getElementsByTagName("shaders")[0].getAttribute("source"));
    
    var contextTag = xmlSource.getElementsByTagName("context")[0];
    if(contextTag!==null) {
        if(contextTag.hasAttribute("antialiasing")) {
            this._antialiasing = (contextTag.getAttribute("antialiasing")==="true");
        }
    }
    var lodLoadProfileTag = xmlSource.getElementsByTagName("lodLoadProfile")[0];
    this._maxLoadedLOD = lodLoadProfileTag.getAttribute("maxLevel");
    if(lodLoadProfileTag.getAttribute("autoLimitByScreenWidth")==="true") {
        var loadLoadLimitTags = lodLoadProfileTag.getElementsByTagName("limit");
        for (i=0;i<loadLoadLimitTags.length;i++) {
            if((window.innerWidth<loadLoadLimitTags[i].getAttribute("screenSizeLessThan"))&&
                    (this._maxLoadedLOD>loadLoadLimitTags[i].getAttribute("level"))) {
                this._maxLoadedLOD = Number(loadLoadLimitTags[i].getAttribute("level"));
            }
        }
    }
    
    var lodDisplayProfileTag = xmlSource.getElementsByTagName("lodDisplayProfile")[0];
    var lodDisplayLimitTags = lodDisplayProfileTag.getElementsByTagName("limit");
    var lodDisplayLimits = new Array(lodDisplayLimitTags.length+1,0);
    for (i=0;i<lodDisplayLimitTags.length;i++) {
        lodDisplayLimits[Number(lodDisplayLimitTags[i].getAttribute("level"))+1]=lodDisplayLimitTags[i].getAttribute("objectSizeLessThan");
    }
    this._lodContext = new LODContext(lodDisplayProfileTag.getAttribute("maxLevel"),lodDisplayLimits);
};

GraphicsContext.prototype.getAntialiasing = function() {
    return this._antialiasing;
};

GraphicsContext.prototype.getMaxLoadedLOD = function() {
    return this._maxLoadedLOD;
};

GraphicsContext.prototype.getLODContext = function() {
    return this._lodContext;
};