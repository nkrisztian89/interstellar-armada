/**
 * @fileOverview This file defines the {@link ScreenComponent} class and its 
 * descendant classes.
 * @author <a href="mailto:nkrisztian89@gmail.com">Krisztián Nagy</a>
 * @version 0.1-dev
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
 * 
 * @param {String} name
 * @returns {SimpleComponent}
 */
function SimpleComponent(name) {
    this._name = name;
    this._element = null;
    this._displayStyle = null;
};

SimpleComponent.prototype.getElement = function() {
    return this._element;
};

SimpleComponent.prototype.setContent = function(newContent) {
    this._element.innerHTML = newContent;
};

SimpleComponent.prototype.initComponent = function() {
    this._element = document.getElementById(this._name);
    this._displayStyle = this._element.style.display;
};

SimpleComponent.prototype.resetComponent = function() {
    this._element = null;
    this._displayStyle = null;
};

SimpleComponent.prototype.hide = function() {
    this._element.style.display = "none";
};

SimpleComponent.prototype.show = function() {
    this._element.style.display = this._displayStyle;
};

/**
 * Defines a screen component object.
 * @class A reusable component that consist of HTML elements (a fragment of a 
 * HTML document) and can be appended to game screens. Various components have
 * to be the descendants of this class, and implement their own various methods.
 * @extends Resource
 * @param {String} name The name of the component to be identified by.
 * @param {String} source The filename of the HTML document where the structure
 * of the component should be defined. The component will be loaded as the first
 * element (and all its children) inside the body tag of this file.
 * @returns {ScreenComponent}
 */
function ScreenComponent(name,source) {
    Resource.call(this);
    
    this._name=name;
    this._source=source;
    
    this._model=null;
    
    this._rootElement = null;
    this._rootElementDefaultDisplayMode = null;
    
    // function to execute when the model is loaded
    this._onModelLoad = function() {};
    
    // source will be undefined when setting the prototypes for inheritance
    if(source!==undefined) {
        this.requestModelLoad();
    }
}

ScreenComponent.prototype = new Resource();
ScreenComponent.prototype.constructor = ScreenComponent;

/**
 * Initiates the asynchronous loading of the component's structure from the
 * external HTML file.
 */
ScreenComponent.prototype.requestModelLoad = function() {
    // send an asynchronous request to grab the XML file containing the DOM of
    // this component
    var request = new XMLHttpRequest();
    request.open('GET', location.pathname+getComponentFolder()+this._source+"?123", true);
    var self = this;
    request.onreadystatechange = function() {
            if(request.readyState===4) {
                self._model = document.implementation.createHTMLDocument(self._name);
                self._model.documentElement.innerHTML = this.responseText;
                var namedElements = self._model.body.querySelectorAll("[id]");
                for(var i = 0; i<namedElements.length; i++) {
                    namedElements[i].setAttribute("id",self._name+"_"+namedElements[i].getAttribute("id"));
                }
                self._onModelLoad();
            }
        };
    request.send(null);
};

/**
 * Appends the component's elements to the current document.
 * @param {Node} [parentNode=document.body] The component will be appended 
 * as child of this node.
 */
ScreenComponent.prototype.appendToPage = function(parentNode) {
    var self = this;
    if(!parentNode) {
        parentNode = document.body;
    }
    var appendToPageFunction = function() {
        self._rootElement = parentNode.appendChild(document.importNode(self._model.body.firstElementChild,true));
        self._rootElementDefaultDisplayMode = self._rootElement.style.display;
        self._initializeComponents();
        self.setToReady();
    };
    // if we have built up the model of the screen already, then load it
    if(this._model!==null) {
        appendToPageFunction();
    // if not yet, set the callback function which fires when the model is 
    // loaded
    } else {
        this._onModelLoad = appendToPageFunction;
    }
};

/**
 * Setting the properties that will be used to easier access DOM elements later.
 * In descendants, this method should be overloaded, adding the additional
 * components of the screen after calling this parent method.
 */
ScreenComponent.prototype._initializeComponents = function() {
};

/**
 * When the page is closed, references to the DOM elements should be removed.
 * In descendants, this method should be overloaded, clearing the additional
 * properties.
 */
ScreenComponent.prototype.resetComponent = function() {
    this.resetResource();
};

/**
 * Sets the display property of the root element of the component to show it.
 */
ScreenComponent.prototype.show = function() {
    var self = this;
    this.executeWhenReady(function() {
        self._rootElement.style.display = self._rootElementDefaultDisplayMode;
    });
};

/**
 * Sets the display property of the root element of the component to hide it.
 */
ScreenComponent.prototype.hide = function() {
    var self = this;
    this.executeWhenReady(function() {
        self._rootElement.style.display = "none";
    });
};

/**
 * Defines a loading box component object.
 * @class A loading box component, that has a title, a progress bar and a status
 * message and appears in the middle of the screen (the corresponding stylesheet 
 * needs to be statically referenced in the head of index.html as of now)
 * @extends ScreenComponent
 * @param {String} name Check ScreenComponent
 * @param {String} source Check ScreenComponent
 * @returns {LoadingBox}
 */
function LoadingBox(name,source) {
    ScreenComponent.call(this,name,source);
    
    this._progress = null;
    this._status = null;
}

LoadingBox.prototype = new ScreenComponent();
LoadingBox.prototype.constructor = LoadingBox;

/**
 * Sets the properties for easier access of the DOM elements.
 */
LoadingBox.prototype._initializeComponents = function() {
    ScreenComponent.prototype._initializeComponents.call(this);
    
    this._progress = this._rootElement.querySelector("progress.loadingBoxProgress");
    this._status = this._rootElement.querySelector("p.loadingBoxStatus");
    
    this.hide();
};

/**
 * When the page is closed, references to the DOM elements should be removed.
 * In descendants, this method should be overloaded, clearing the additional
 * properties.
 */
LoadingBox.prototype.resetComponent = function() {
    ScreenComponent.prototype.resetComponent.call(this);
    
    this._progress = null;
    this._status = null;
};

/**
 * Updates the value of the progress bar shown on the loading box.
 * @param {Number} value The new value of the progress bar.
 */
LoadingBox.prototype.updateProgress= function(value) {
    var self = this;
    this.executeWhenReady(function() {
        self._progress.value = value;
    });
};

/**
 * Updates the status message shown on the loading box.
 * @param {String} status The new status to show.
 */
LoadingBox.prototype.updateStatus= function(status) {
    var self = this;
    this.executeWhenReady(function() {
        self._status.innerHTML = status;
    });
};

/**
 * Defines an info box component object.
 * @class An info box component, that has a title, and a message to tell to the
 * user and appears in the middle of the screen (the corresponding stylesheet 
 * needs to be statically referenced in the head of index.html as of now)
 * @extends ScreenComponent
 * @param {String} name Check ScreenComponent
 * @param {String} source Check ScreenComponent
 * @returns {InfoBox}
 */
function InfoBox(name,source) {
    ScreenComponent.call(this,name,source);
    
    this._message = null;
}

InfoBox.prototype = new ScreenComponent();
InfoBox.prototype.constructor = InfoBox;

/**
 * Sets the properties for easier access of the DOM elements.
 */
InfoBox.prototype._initializeComponents = function() {
    ScreenComponent.prototype._initializeComponents.call(this);
    
    var self = this;
    
    this._message = this._rootElement.querySelector("p.infoBoxMessage");
    this._rootElement.querySelector("a.infoBoxOKButton").onclick=function(){self.hide();};
    
    this.hide();
};

/**
 * When the page is closed, references to the DOM elements should be removed.
 * In descendants, this method should be overloaded, clearing the additional
 * properties.
 */
InfoBox.prototype.resetComponent = function() {
    ScreenComponent.prototype.resetComponent.call(this);
    
    this._message = null;
};

/**
 * Updates the message shown on the info box.
 * @param {String} message The new message to show.
 */
InfoBox.prototype.updateMessage= function(message) {
    var self = this;
    this.executeWhenReady(function() {
        self._message.innerHTML = message;
    });
};

/**
 * Defines a menu component object.
 * @class A component that consists of a container and a list of menu options
 * inside, which execute given functions when clicked on.
 * @extends ScreenComponent
 * @param {String} name Check {@link ScreenComponent}
 * @param {String} source Check {@link ScreenComponent}
 * @param {Object[]} menuOptions An array of the available menu options, each
 * described by an object with a caption (String) and an action (Function) 
 * property
 * @returns {MenuComponent}
 */
function MenuComponent(name,source,menuOptions) {
    ScreenComponent.call(this,name,source);
    
    /**
     * An array of the available menu options, each described by an object with 
     * a caption (String) and an action (Function) property
     * @name MenuComponent#_menuOptions
     * @type Object[]
     */
    this._menuOptions = menuOptions;
}

MenuComponent.prototype = new ScreenComponent();
MenuComponent.prototype.constructor = MenuComponent;

/**
 * Sets up the menu by appending the buttons to the container
 */
MenuComponent.prototype._initializeComponents = function() {
    ScreenComponent.prototype._initializeComponents.call(this);
    
    var i;
    var aElement;
    var liElement;
    
    for(i=0;i<this._menuOptions.length;i++) {
        aElement=document.createElement("a");
        aElement.href="#";
        aElement.className="menu button";
        aElement.innerHTML=this._menuOptions[i].caption;
        aElement.addEventListener("click",this._menuOptions[i].action);
        liElement=document.createElement("li");
        liElement.className="transparentContainer";
        liElement.appendChild(aElement);
        this._rootElement.appendChild(liElement);
    }
};

/**
 * When the page is closed, references to the DOM elements should be removed.
 * In descendants, this method should be overloaded, clearing the additional
 * properties.
 */
MenuComponent.prototype.resetComponent = function() {
    ScreenComponent.prototype.resetComponent.call(this);
};

/**
 * 
 * @param {String} name
 * @param {String} source
 * @param {String} propertyName
 * @param {String[]} valueList
 * @returns {Selector}
 */
function Selector(name,source,propertyName,valueList) {
    ScreenComponent.call(this,name,source);
    
    this._propertyName = propertyName;
    this._valueList = valueList;
    this._valueIndex = null;
    
    this._propertyLabel = null;
    this._valueSelector = null;
}

Selector.prototype = new ScreenComponent();
Selector.prototype.constructor = Selector;

/**
 * Sets the properties for easier access of the DOM elements.
 */
Selector.prototype._initializeComponents = function() {
    ScreenComponent.prototype._initializeComponents.call(this);
    
    this._propertyLabel = this._rootElement.querySelector("#"+this._name+"_property");
    this._propertyLabel.innerHTML = this._propertyName;
    this._valueSelector = this._rootElement.querySelector("#"+this._name+"_value");
    this._valueSelector.innerHTML = this._valueList[0];
    this._valueIndex = 0;
    
    var self = this;
    this._valueSelector.onclick = function(){ self.selectNextValue(); };
};

/**
 * When the page is closed, references to the DOM elements should be removed.
 * In descendants, this method should be overloaded, clearing the additional
 * properties.
 */
Selector.prototype.resetComponent = function() {
    ScreenComponent.prototype.resetComponent.call(this);
    
    this._propertyLabel = null;
    this._valueSelector = null;
};

/**
 * 
 * @param {String} value
 */
Selector.prototype.selectValue = function(value) {
    this.executeWhenReady(function() {
        var i = 0;
        while((i<this._valueList.length)&&(this._valueList[i]!==value)) {
            i++;
        }
        if(i<this._valueList.length) {
            this.selectValueWithIndex(i);
        }
    });
};

/**
 * 
 * @param {Number} index
 */
Selector.prototype.selectValueWithIndex = function(index) {
    this.executeWhenReady(function() {
        this._valueIndex = index;
        this._valueSelector.innerHTML = this._valueList[this._valueIndex];
    });
};

Selector.prototype.getSelectedValue = function() {
    return this._valueList[this._valueIndex];
};

Selector.prototype.getSelectedIndex = function() {
    return this._valueIndex;
};

Selector.prototype.selectNextValue = function() {
    this.executeWhenReady(function() {
        this.selectValueWithIndex((this._valueIndex + 1)%this._valueList.length);
    });
};