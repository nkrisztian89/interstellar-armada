/**
 * Copyright 2017, 2020-2021, 2023-2024 Krisztián Nagy
 * @file Provides the setup and event-handling for the preview window used for texture resources within the Interstellar Armada editor.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param utils Used to check for array equality
 * @param resources Used to request the loading of the texture
 * @param graphics Used to process the shader source code according to current graphics settings
 * @param common Used to create the elements for the settings options
 */
define([
    "utils/utils",
    "modules/media-resources",
    "armada/graphics",
    "editor/common"
], function (utils, resources, graphics, common) {
    "use strict";
    var
            // ----------------------------------------------------------------------
            // Constants
            /**
             * The names of properties the change of which should trigger an update of the preview div
             * @type String[]
             */
            DIV_UPDATE_PROPERTIES = [
                "basepath",
                "format",
                "typeSuffixes",
                "qualitySuffixes"
            ],
            /**
             * The possible values to use for background selection
             * @type String[]
             */
            BACKGROUND_TYPES = ["transparent", "black", "checkerboard"],
            // ----------------------------------------------------------------------
            // Private variables
            /**
             * A reference to the object storing the HTML elements to be used for the preview
             * @type Object
             */
            _elements,
            /**
             * The div element that has the texture images added as children
             * @type HTMLDivElement
             */
            _imageDiv,
            /**
             * Direct references to the Image elements in the same order as TextureResource.getTypes()
             * returns the list of available types. Each image corresponds to the type at the same
             * index in that array. The same image might be present multiple times in the array, if
             * it corresponds to multiple texture types.
             * @type Image[]
             */
            _images = [],
            /**
             * Direct reference to the currently visible image
             * @type Image
             */
            _image,
            /**
             * A reference to the displayed texture resource
             * @type ShaderResource
             */
            _textureResource,
            /**
             * The list of texture types the current texture resource has images for
             * @type String[]
             */
            _textureTypes,
            /**
             * The currently selected texture type - the image corresponding to this type is
             * visible, while the others are hidden
             * @type String
             */
            _textureType,
            /**
             * The type of background to use for the (transparent parts of) the image elements.
             * One of BACKGROUND_TYPES.
             * @type String
             */
            _background = "transparent",
            /**
             * 
             * @type Object
             */
            _optionElements = {
                textureTypeSelector: null
            };
    // ----------------------------------------------------------------------
    // Private Functions
    /**
     * Updates the info text at the bottom of the preview according to the current image
     */
    function _updateInfo() {
        _elements.info.innerHTML = _image ? "Image: " + _textureResource.getPathForType(_textureType, graphics.getTextureQualityPreferenceList()) +
                ", size: " + _image.naturalWidth + "x" + _image.naturalHeight : "";
        _elements.info.hidden = !_elements.info.innerHTML;
    }
    /**
     * Updates the preview according to the currently selected texture type
     */
    function _updateForTextureType() {
        var i, types = _textureResource.getTypes();
        _image = null;
        for (i = 0; i < types.length; i++) {
            _images[i].hidden = true;
        }
        for (i = 0; i < types.length; i++) {
            if (types[i] === _textureType) {
                _images[i].hidden = false;
                _image = _images[i];
                break;
            }
        }
        _updateInfo();
    }
    /**
     * Updates the preview according to the currently selected background
     */
    function _updateForBackground() {
        if (_imageDiv) {
            if (_background === "black") {
                _imageDiv.classList.add("black-background");
            } else {
                _imageDiv.classList.remove("black-background");
            }
            if (_background === "checkerboard") {
                _imageDiv.classList.add("checkerboard-background");
            } else {
                _imageDiv.classList.remove("checkerboard-background");
            }
        }
    }
    /**
     * Creates the controls that form the content of the preview options and adds them to the page.
     */
    function _createOptions() {
        _elements.options.innerHTML = "";
        // texture type selector
        _optionElements.textureTypeSelector = common.createSelector(_textureTypes, _textureType, false, function () {
            _textureType = _optionElements.textureTypeSelector.value;
            _updateForTextureType();
        });
        // background selector
        _optionElements.backgroundSelector = common.createSelector(BACKGROUND_TYPES, _background, false, function () {
            _background = _optionElements.backgroundSelector.value;
            _updateForBackground();
        });
        _elements.options.appendChild(common.createSetting(_optionElements.textureTypeSelector, "Type:"));
        _elements.options.appendChild(common.createSetting(_optionElements.backgroundSelector, "Background:"));
        _elements.options.hidden = (_elements.options.innerHTML === "");
    }
    // ----------------------------------------------------------------------
    // Public Functions
    /**
     * The main function that sets up the preview window for the editor to show the selected 
     * shader recource.
     * @param {Editor~RefreshElements} [elements] References to the HTML elements that can be used for the preview.
     * @param {SpacecraftClass} [textureResource] The shader resource to preview
     */
    function refresh(elements, textureResource) {
        var managedTextures, i;
        _textureResource = textureResource || _textureResource;
        _elements = elements || _elements;
        graphics.getTexture(_textureResource.getName());
        resources.executeWhenReady(function () {
            if ((_textureResource.getTypes().indexOf(_textureType) < 0) || !utils.arraysEqual(_textureResource.getTypes(), _textureTypes)) {
                _textureTypes = _textureResource.getTypes();
                _textureType = _textureTypes[0];
            }

            _createOptions();
            _elements.div.hidden = false;
            _elements.canvas.hidden = true;

            managedTextures = graphics.getTexture(_textureResource.getName()).getManagedTexturesOfTypes(_textureTypes, graphics.getTextureQualityPreferenceList());

            _imageDiv = document.createElement("div");
            _imageDiv.classList.add("previewImageContainer");
            _updateForBackground();

            _images.length = 0;
            for (i = 0; i < _textureTypes.length; i++) {
                // we might append the same image multiple times (which will just move it back to the last place among the children),
                // so make sure we keep a separate array with the image references in the correct order
                _imageDiv.appendChild(managedTextures[_textureTypes[i]]._image);
                _images.push(managedTextures[_textureTypes[i]]._image);
            }

            _elements.div.appendChild(_imageDiv);
            _updateForTextureType();
        });
        resources.requestResourceLoad();
    }
    /**
     * Clears the preview 
     */
    function clear() {
        if (_imageDiv) {
            _imageDiv.parentNode.removeChild(_imageDiv);
            _imageDiv = null;
        }
        _images.length = 0;
        _image = null;
    }
    /**
     * Updates the preview (refreshes if needed) in case the property with the given name changed
     * @param {String} name
     */
    function handleDataChanged(name) {
        if (DIV_UPDATE_PROPERTIES.indexOf(name) >= 0) {
            clear();
            refresh();
        }
    }
    /**
     * Called from outside
     */
    function handleStartEdit() {
        return true;
    }
    /**
     * Called from outside
     */
    function handleStopEdit() {
        return true;
    }
    // ----------------------------------------------------------------------
    // Initialization
    // ----------------------------------------------------------------------
    // The public interface of the module
    return {
        refresh: refresh,
        clear: clear,
        handleDataChanged: handleDataChanged,
        handleStartEdit: handleStartEdit,
        handleStopEdit: handleStopEdit
    };
});
