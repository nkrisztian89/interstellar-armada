/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file Provides an interface to interact with WebGL in a managed way. Offers
 * rather low level functionality, but using it is still much more transparent 
 * than accessing WebGL directly.
 * Usage:
 * - create a managed context and associate it with an HTML5 canvas element
 * - create the managed resources that you want to use (textures, shaders, models)
 * - set the data for the managed resources using their provided methods
 * - add the resources to the context
 * - set up the context
 * - set the shader and its uniforms using the managed resources
 * - use the render function of the model to render it to the context
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, plusplus: true, white: true */
/*global define, Image, Float32Array, parseInt, document */

/**
 * @param utils Used for enum functionality
 * @param types Used for enum functionality
 * @param application This module uses the logging and error displaying functions of the generic application module
 * @param asyncResource This module uses the AsyncResource class for easier handling of managed context resource preparation
 */
define([
    "utils/utils",
    "utils/types",
    "modules/application",
    "modules/async-resource"
], function (utils, types, application, asyncResource) {
    "use strict";
    var
            // ----------------------------------------------------------------------
            // enums
            /**
             * An enumeration storing the possible values for texture filtering
             * @enum {String}
             */
            TextureFiltering = {
                BILINEAR: "bilinear",
                TRILINEAR: "trilinear",
                ANISOTROPIC: "anisotropic"
            },
    /**
     * Enumeration defining the available (supported) variables types in GLSL shaders.
     * @enum {String}
     * @type String
     */
    ShaderVariableType = {
        NONE: "none",
        FLOAT: "float",
        VEC2: "vec2",
        VEC3: "vec3",
        VEC4: "vec4",
        MAT2: "mat2",
        MAT3: "mat3",
        MAT4: "mat4",
        SAMPLER2D: "sampler2D",
        SAMPLER_CUBE: "samplerCube",
        INT: "int",
        BOOL: "bool",
        STRUCT: "struct"
    },
    /**
     * The possible blend modes based on which the blend function is set when a shader is applied.
     * @enum {String}
     * @type String
     */
    ShaderBlendMode = {
        NONE: "none",
        MIX: "mix",
        ADD: "add"
    },
    // ----------------------------------------------------------------------
    // Constants
    UNIFORM_NAME_PREFIX = "u_",
            UNIFORM_NAME_SUFFIX = "",
            TEXTURE_UNIFORM_NAME_PREFIX = "",
            TEXTURE_UNIFORM_NAME_SUFFIX = "Texture",
            CUBEMAP_UNIFORM_NAME_PREFIX = "",
            CUBEMAP_UNIFORM_NAME_SUFFIX = "Cubemap",
            // ----------------------------------------------------------------------
            // Private variables
            /**
             * @type ManagedGLContext
             */
            _genericContext = null;
    Object.freeze(TextureFiltering);
    Object.freeze(ShaderVariableType);
    /**
     * Returns the size of one variable if the passed type if it is converted to a float vector. (how many floats does it occupy)
     * @param {String} shaderVariableType (enum ShaderVariableType)
     * @returns {Number}
     */
    function getFloatVectorSize(shaderVariableType) {
        switch (shaderVariableType) {
            case ShaderVariableType.NONE:
                return 0;
            case ShaderVariableType.FLOAT:
                return 1;
            case ShaderVariableType.VEC2:
                return 2;
            case ShaderVariableType.VEC3:
                return 3;
            case ShaderVariableType.VEC4:
                return 4;
            case ShaderVariableType.MAT2:
                return 4;
            case ShaderVariableType.MAT3:
                return 9;
            case ShaderVariableType.MAT4:
                return 16;
            case ShaderVariableType.SAMPLER2D:
                return 1;
            case ShaderVariableType.SAMPLER_CUBE:
                return 1;
            case ShaderVariableType.INT:
                return 1;
            case ShaderVariableType.BOOL:
                return 1;
            default:
                application.showError("Cannot determine vector size of GLSL type '" + shaderVariableType + "'!");
                return 0;
        }
    }
    /**
     * Returns how many 4 component vectors does a shader variable of the passed type take in space. (for counting shader requirements)
     * @param {String} shaderVariableType (enum ShaderVariableType)
     * @returns {Number}
     */
    function getVectorCount(shaderVariableType) {
        switch (shaderVariableType) {
            case ShaderVariableType.NONE:
                return 0;
            case ShaderVariableType.FLOAT:
                return 1;
            case ShaderVariableType.VEC2:
                return 1;
            case ShaderVariableType.VEC3:
                return 1;
            case ShaderVariableType.VEC4:
                return 1;
            case ShaderVariableType.MAT2:
                return 2;
            case ShaderVariableType.MAT3:
                return 3;
            case ShaderVariableType.MAT4:
                return 4;
            case ShaderVariableType.SAMPLER2D:
                return 1;
            case ShaderVariableType.SAMPLER_CUBE:
                return 1;
            case ShaderVariableType.INT:
                return 1;
            case ShaderVariableType.BOOL:
                return 1;
            default:
                application.showError("Cannot determine vector count of GLSL type '" + shaderVariableType + "'!");
                return 0;
        }
    }
    /**
     * Returns whether a shader variable of the passed type takes a texture unit.
     * @param {String} shaderVariableType (enum ShaderVariableType)
     * @returns {Boolean}
     */
    function isTextureType(shaderVariableType) {
        return (shaderVariableType === ShaderVariableType.SAMPLER2D) ||
                (shaderVariableType === ShaderVariableType.SAMPLER_CUBE);
    }
    /**
     * Returns a numberic value that can be assigned as an int to a boolean GLSL variable.
     * @param {Boolean} value
     * @returns {Number}
     */
    function intValueOfBool(value) {
        return value ? 1 : 0;
    }
    // ############################################################################################
    /**
     * @class Represents a managed WebGL texture.
     * @param {String} name
     * @param {Image} image The Image object that contains the data of the
     * texture and can be passed to WebGL. It has to already contain the data
     * when you add this texture to any context.
     * @param {Boolean} [useMipmap=true] Whether mipmapping should be used with
     * this texture.
     * @returns {ManagedTexture}
     */
    function ManagedTexture(name, image, useMipmap) {
        /**
         * @type String
         */
        this._name = name;
        /**
         * Contains the data to be passed to WebGL.
         * @type Image
         */
        this._image = image;
        /**
         * Whether mipmapping should be used with this texture.
         * @type Boolean
         */
        this._mipmap = (useMipmap !== undefined) ? useMipmap : true;
        /**
         * The associative array of WebGL texture IDs belonging to managed 
         * contexts which this texture has been associated with. The keys are 
         * the names of the managed contexts, and values are the WebGL IDs 
         * (handles)
         * @type Object.<String, WebGLTexture>
         */
        this._ids = {};
        /**
         * The associative array of bound WebGL texture locations (texture unit indices)
         * belonging to managed contexts which this texture has been associated with. 
         * The keys are the names of the managed contexts, and values are the location
         * indices.
         * @type Object.<String, Number>
         */
        this._locations = {};
    }
    /**
     * @returns {String}
     */
    ManagedTexture.prototype.getName = function () {
        return this._name;
    };
    /**
     * Returns the texture unit index where this texture has been last bound to within the context with the passed name.
     * @param {String} contextName
     * @returns {Number}
     */
    ManagedTexture.prototype.getLastTextureBindLocation = function (contextName) {
        return this._locations[contextName];
    };
    /**
     * Clears the cached value storing the last bind location for this texture, associated with the passed context name.
     * @param {String} contextName
     */
    ManagedTexture.prototype.forgetLastTextureBindLocation = function (contextName) {
        delete this._locations[contextName];
    };
    /**
     * Sets the minification filter to be used when sampling this texture. Requires the texture to be bound!
     * @param {WebGLRenderingContext} gl
     * @param {String} filtering (enum TextureFiltering)
     * @param {EXTTextureFilterAnisotropic} anisotropicFilterExt
     */
    ManagedTexture.prototype.setMinFiltering = function (gl, filtering, anisotropicFilterExt) {
        if (this._mipmap === false) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        } else {
            switch (filtering) {
                case TextureFiltering.BILINEAR:
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
                    break;
                case TextureFiltering.TRILINEAR:
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                    break;
                case TextureFiltering.ANISOTROPIC:
                    gl.texParameterf(gl.TEXTURE_2D, anisotropicFilterExt.TEXTURE_MAX_ANISOTROPY_EXT, 4);
                    break;
            }
            gl.generateMipmap(gl.TEXTURE_2D);
        }
    };
    /**
     * Creates the underlying WebGL texture object and associates it with the passed context name.
     * @param {String} contextName
     * @param {WebGLRenderingContext} gl
     */
    ManagedTexture.prototype.createGLTexture = function (contextName, gl) {
        this._ids[contextName] = gl.createTexture();
    };
    /**
     * Binds the underlying WebGL texture object with the passed context and caches the location where it was bound for later use, associated
     * with the passed context name.
     * @param {String} contextName
     * @param {WebGLRenderingContext} gl
     * @param {Number} location The texture unit index where to bind the texture.
     */
    ManagedTexture.prototype.bindGLTexture = function (contextName, gl, location) {
        gl.activeTexture(gl.TEXTURE0 + location);
        gl.bindTexture(gl.TEXTURE_2D, this._ids[contextName]);
        this._locations[contextName] = location;
    };
    /**
     * Loads the image data into the underlying WebGL texture object and sets up wrapping and filtering. Requires the texture to be bound!
     * @param {WebGLRenderingContext} gl
     * @param {String} filtering (enum TextureFiltering)
     * @param {EXTTextureFilterAnisotropic} anisotropicFilterExt
     */
    ManagedTexture.prototype.setupGLTexture = function (gl, filtering, anisotropicFilterExt) {
        // Upload the image into the texture.
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._image);
        // Set the parameters so we can render any size image.
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        this.setMinFiltering(gl, filtering, anisotropicFilterExt);
    };
    /**
     * Deletes the underlying WebGL texture object associated with the passed context name.
     * @param {String} contextName
     * @param {WebGLRenderingContext} gl
     */
    ManagedTexture.prototype.deleteGLTexture = function (contextName, gl) {
        if (this._ids[contextName]) {
            gl.deleteTexture(this._ids[contextName]);
            delete this._ids[contextName];
            delete this._locations[contextName];
        }
    };
    // ############################################################################################
    /**
     * Creates a new Cubemap object.
     * @class Represents a cube mapped texture resource.
     * @param {String} name The name of cubemap resource
     * @param {String[6]} images An array containing the URLs of the 6 faces of
     * the cubemapped texture. The order of the pictures has to be X,Y,Z and within
     * that, always positive first.
     */
    function ManagedCubemap(name, images) {
        // properties for file resource management
        /**
         * The name by wich this resource will be referred to. (has to be unique for
         * each instance)
         * @type String
         */
        this._name = name;
        /**
         * 6 Image objects to manage the loading of the 6 textures of the faces from
         * their source files.
         * @type Image[6]
         */
        this._images = images;
        // properties for WebGL resource management
        /**
         * The associative array of WebGL cubemap IDs belonging to managed contexts 
         * which this cubemap has been associated with. The keys are the names of the managed
         * contexts, and values are the WebGL IDs (handles)
         * @type Object
         */
        this._ids = {};
        /**
         * The associative array of bound WebGL texture locations (texture unit indices)
         * belonging to managed contexts which this cubemap has been associated with. 
         * The keys are the names of the managed contexts, and values are the location
         * indices.
         * @type Object
         */
        this._locations = {};
    }
    /**
     * Getter for the property _name.
     * @returns {String}
     */
    ManagedCubemap.prototype.getName = function () {
        return this._name;
    };
    /**
     * Returns the texture unit index where this cubemap has been last bound to within the context with the passed name.
     * @param {String} contextName
     * @returns {Number}
     */
    ManagedCubemap.prototype.getLastTextureBindLocation = function (contextName) {
        return this._locations[contextName];
    };
    /**
     * Clears the cached value storing the last bind location for this cubemap, associated with the passed context name.
     * @param {String} contextName
     */
    ManagedCubemap.prototype.forgetLastTextureBindLocation = function (contextName) {
        delete this._locations[contextName];
    };
    /**
     * Creates the underlying WebGL texture object and associates it with the passed context name.
     * @param {String} contextName
     * @param {WebGLRenderingContext} gl
     */
    ManagedCubemap.prototype.createGLTexture = function (contextName, gl) {
        this._ids[contextName] = gl.createTexture();
    };
    /**
     * Binds the underlying WebGL texture object with the passed context and caches the location where it was bound for later use, associated
     * with the passed context name.
     * @param {String} contextName
     * @param {WebGLRenderingContext} gl
     * @param {Number} location The texture unit index where to bind the texture.
     */
    ManagedCubemap.prototype.bindGLTexture = function (contextName, gl, location) {
        gl.activeTexture(gl.TEXTURE0 + location);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, this._ids[contextName]);
        this._locations[contextName] = location;
    };
    /**
     * Loads the image data into the underlying WebGL texture object and sets up wrapping and filtering. Requires the texture to be bound!
     * @param {WebGLRenderingContext} gl
     */
    ManagedCubemap.prototype.setupGLTexture = function (gl) {
        var type, i;
        // Set the parameters so we can render any size image.
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        type = [
            gl.TEXTURE_CUBE_MAP_POSITIVE_X,
            gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
            gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
            gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
            gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
            gl.TEXTURE_CUBE_MAP_NEGATIVE_Z
        ];
        // Upload the images into the texture.
        for (i = 0; i < 6; i++) {
            gl.texImage2D(type[i], 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._images[i]);
        }
    };
    /**
     * Deletes the underlying WebGL texture object associated with the passed context name.
     * @param {String} contextName
     * @param {WebGLRenderingContext} gl
     */
    ManagedCubemap.prototype.deleteGLTexture = function (contextName, gl) {
        if (this._ids[contextName]) {
            gl.deleteTexture(this._ids[contextName]);
            delete this._ids[contextName];
            delete this._locations[contextName];
        }
    };
    // ############################################################################################
    /**
     * Creates a new ShaderAttribute.
     * @class A wrapper class for storing the attributes used in a given shader 
     * program. Used as a simple struct, doesn't have any methods, the only purpose
     * of it is to organize the storage of attribute properties.
     * @param {String} name Name of the shader attribute. (same as defined in the 
     * shader source)
     * @param {Number} size Size of the shader attribute: how many elements does
     * it have (e.g. float -> 1, vec3 -> 3)
     * @param {String} role Role of the shader attribute, based on which the
     * appropriate buffer will be assigned to it to supply the values. Currently
     * supported roles are: position, texCoord, normal, color, luminosity, 
     * shininess, groupIndex.
     */
    function ShaderAttribute(name, size, role) {
        this.name = name;
        this.size = size;
        this.role = role;
    }
    // ############################################################################################
    /**
     * Creates a new ShaderUniform.
     * @class A class representing and wrapping a GLSL uniform variable.
     * @param {String} name The name of the uniform variable. Has to be the same
     * as the name specified in the GLSL source.
     * @param {String} type The type of the uniform variable. Only certain variable
     * types are supported. @see ShaderUniform#VariableTypes
     * @param {Number} arraySize If 0 or undefined, the uniform is not an array. If 
     * one or more, then gives the size of the uniform array.
     */
    function ShaderUniform(name, type, arraySize) {
        // properties for file resource management
        /**
         * The name of the shader uniform, same as how declared in the shader source
         * file(s).
         * @type String
         */
        this._name = name;
        /**
         * The type of variable this uniform is, from an enumeration of supported
         * types. This is used to determine the appropriate assignment function.
         */
        this._type = types.getEnumValue(ShaderVariableType, type, {name: "uniform " + this._name + ".type", defaultValue: ShaderVariableType.NONE});
        /**
         * The length of the array in case this uniform is declared as an array in
         * GLSL. Only float and struct arrays are supported so far.
         * @type Number
         */
        this._arraySize = arraySize || 0;
        /**
         * If the uniform is of struct type, other ShaderUniform instances represent
         * its members (and setting it will set the members instead). The members
         * are stored in this array.
         * @type ShaderUniform[]
         */
        this._members = (this._type === ShaderVariableType.STRUCT) ? [] : null;
        // properties for WebGL resource management
        /**
         * The associative array containing the locations of this uniform variable
         * belonging to different managed WebGL contexts. The keys are the names of the managed
         * contexts, and values are the locations.
         * @type Object
         */
        this._locations = {};
        /**
         * The numeric value that was last assigned to this uniform through webGL (and thus is retained).
         * Only used for variable types that have a numeric (not array) value to avoid assigning the same
         * value multiple times.
         * @type Number
         */
        this._numericValue = 0;
    }
    /**
     * Getter for the property _name.
     * @returns {String}
     */
    ShaderUniform.prototype.getName = function () {
        return this._name;
    };
    /**
     * Adds the given shader uniform to the list of members this uniforms has (for
     * struct type uniforms)
     * @param {ShaderUniform} member
     */
    ShaderUniform.prototype.addMember = function (member) {
        if (this._type === ShaderVariableType.STRUCT) {
            this._members.push(member);
        } else {
            application.showError("Attempting to add a member to uniform " + this._name + ", which is not of struct type!");
        }
    };
    /**
     * Gets the location of the uniform in the supplied rendering context and stores it associated with the passed context name for faster 
     * reference with getLocation later.
     * @param {String} contextName
     * @param {WebGLRenderingContext} gl 
     * @param {ManagedShader} shader The shader which this uniform belongs to.
     * @param {String} [locationPrefix] Same as for the setValue() method
     */
    ShaderUniform.prototype.saveLocation = function (contextName, gl, shader, locationPrefix) {
        if (!this._locations[contextName]) {
            this._locations[contextName] = {};
        }
        this._locations[contextName][(locationPrefix || "self")] = gl.getUniformLocation(shader.getIDForContext(contextName), (locationPrefix || "") + this._name);
    };
    /**
     * Deletes the cached uniform locations associated with the passed context name. If the uniform has members, their cached locations are 
     * erased, too.
     * @param {String} contextName
     */
    ShaderUniform.prototype.forgetLocations = function (contextName) {
        var i, j;
        delete this._locations[contextName];
        this._numericValue = 0;
        if (this._members) {
            for (i = 0; i < this._arraySize; i++) {
                for (j = 0; j < this._members.length; j++) {
                    this._members[j].forgetLocations(contextName);
                }
            }
        }
    };
    /**
     * Gets the location of this uniform valid in the supplied context. For simple uniform types, the location
     * has to be grabbed from the context with a saveLocation prior to the usage of this, otherwise it will 
     * return undefined! For complex types (with locationPrefix), the location is grabbed from GL here, if
     * necessary.
     * @param {String} contextName
     * @param {WebGLRenderingContext} gl
     * @param {ManagedShader} shader The shader which this uniform belongs to.
     * @param {String} [locationPrefix] Same as for the setValue() method
     * @returns {WebGLUniformLocation}
     */
    ShaderUniform.prototype.getLocation = function (contextName, gl, shader, locationPrefix) {
        if (locationPrefix && (!this._locations[contextName] || (this._locations[contextName][locationPrefix] === undefined))) {
            this.saveLocation(contextName, gl, shader, locationPrefix);
        }
        return this._locations[contextName][(locationPrefix || "self")];
    };
    /**
     * If this uniform is an array, returns the length of the array, otherwise returns 0.
     * @returns {Number}
     */
    ShaderUniform.prototype.getArraySize = function () {
        return this._arraySize;
    };
    /**
     * Returns the name of this uniform with general uniform prefixes and suffixes removed.
     * @returns {String}
     */
    ShaderUniform.prototype.getRawName = function () {
        var result = this._name, parts;
        if (UNIFORM_NAME_PREFIX.length > 0) {
            parts = result.split(UNIFORM_NAME_PREFIX);
            result = parts[parts.length - 1];
        }
        if (UNIFORM_NAME_SUFFIX.length > 0) {
            result = result.split(UNIFORM_NAME_SUFFIX)[0];
        }
        return result;
    };
    /**
     * If this is a 2D texture sampler, this will return the type of texture it is sampling based on its name (with prefixes and suffixes
     * removed), otherwise will return null. Uniforms without the proper prefixes and suffixes also return null.
     * @returns {String|null}
     */
    ShaderUniform.prototype.getTextureType = function () {
        var result, parts;
        if (this._type !== ShaderVariableType.SAMPLER2D) {
            return null;
        }
        result = this.getRawName();
        if (TEXTURE_UNIFORM_NAME_PREFIX.length > 0) {
            parts = result.split(TEXTURE_UNIFORM_NAME_PREFIX);
            if (parts.length < 2) {
                return null;
            }
            result = parts[parts.length - 1];
        }
        if (TEXTURE_UNIFORM_NAME_SUFFIX.length > 0) {
            parts = result.split(TEXTURE_UNIFORM_NAME_SUFFIX);
            if (parts.length < 2) {
                return null;
            }
            result = parts[0];
        }
        return result;
    };
    /**
     * If this is a cubemap texture sampler, this will return the name of the cubemap it is sampling based on its name (with prefixes and suffixes
     * removed), otherwise will return null. Uniforms without the proper prefixes and suffixes also return null.
     * @returns {String|null}
     */
    ShaderUniform.prototype.getCubemapName = function () {
        var result, parts;
        if (this._type !== ShaderVariableType.SAMPLER_CUBE) {
            return null;
        }
        result = this.getRawName();
        if (CUBEMAP_UNIFORM_NAME_PREFIX.length > 0) {
            parts = result.split(CUBEMAP_UNIFORM_NAME_PREFIX);
            if (parts.length < 2) {
                return null;
            }
            result = parts[parts.length - 1];
        }
        if (CUBEMAP_UNIFORM_NAME_SUFFIX.length > 0) {
            parts = result.split(CUBEMAP_UNIFORM_NAME_SUFFIX);
            if (parts.length < 2) {
                return null;
            }
            result = parts[0];
        }
        return result;
    };
    /**
     * @static
     * Returns a name prefixed and suffixed like general uniform variables.
     * @param {String} rawName
     * @returns {String}
     */
    ShaderUniform.prototype.getUniformName = function (rawName) {
        return UNIFORM_NAME_PREFIX + rawName + UNIFORM_NAME_SUFFIX;
    };
    /**
     * Returns the raw uniform name to be used for a texture sampler corresponding to a texture with the passed type / role (e.g. "diffuse")
     * Applying the general uniform prefixes and suffixes to this name will give the final uniform name for the sampler.
     * (e.g. diffuse -> diffuseTexture -> u_diffuseTexture)
     * @param {String} textureType
     * @returns {String}
     */
    ShaderUniform.prototype.getTextureUniformRawName = function (textureType) {
        return TEXTURE_UNIFORM_NAME_PREFIX + textureType + TEXTURE_UNIFORM_NAME_SUFFIX;
    };
    /**
     * Returns the raw uniform name to be used for a cube sampler corresponding to a cubemap with the passed name / role
     * Applying the general uniform prefixes and suffixes to this name will give the final uniform name for the sampler.
     * @param {String} cubemapName
     * @returns {String}
     */
    ShaderUniform.prototype.getCubemapUniformRawName = function (cubemapName) {
        return CUBEMAP_UNIFORM_NAME_PREFIX + cubemapName + CUBEMAP_UNIFORM_NAME_SUFFIX;
    };
    /**
     * Sets the value of the shader uniform in the specified GL context to the passed value.
     * @param {String} contextName The name of the managed GL context
     * @param {WebGLRenderingContext} gl
     * @param {ManagedShader} shader The shader which this uniform belongs to.
     * @param {any} value The new uniform value.
     * The type of this argument should be appropriate to the uniform type.
     * For structs, it needs to be an Object with properties which have names
     * equal to the names of the members of the struct and the values are of 
     * appropriate type for the corresponding member.
     * @param {String} locationPrefix For uniform struct members, this string has to
     * contain the prefix that needs to be appended before their name to get their
     * access string to grab their location from the GL context. E.g. for 
     * "lights[3].color", the name would be "color" and so the prefix should be
     * "lights[3]."
     */
    ShaderUniform.prototype.setConstantValue = function (contextName, gl, shader, value, locationPrefix) {
        var location, i, j, memberName, numericValue;
        // get the location
        location = this.getLocation(contextName, gl, shader, locationPrefix);
        switch (this._type) {
            case ShaderVariableType.FLOAT:
                if (this._arraySize > 0) {
                    gl.uniform1fv(location, value);
                } else {
                    if (locationPrefix || (this._numericValue !== value)) {
                        gl.uniform1f(location, value);
                        this._numericValue = value;
                    }
                }
                break;
            case ShaderVariableType.VEC2:
                gl.uniform2fv(location, value);
                break;
            case ShaderVariableType.VEC3:
                gl.uniform3fv(location, value);
                break;
            case ShaderVariableType.VEC4:
                gl.uniform4fv(location, value);
                break;
            case ShaderVariableType.MAT2:
                gl.uniformMatrix2fv(location, false, value);
                break;
            case ShaderVariableType.MAT3:
                gl.uniformMatrix3fv(location, false, value);
                break;
            case ShaderVariableType.MAT4:
                gl.uniformMatrix4fv(location, false, value);
                break;
            case ShaderVariableType.SAMPLER2D:
            case ShaderVariableType.SAMPLER_CUBE:
            case ShaderVariableType.INT:
                if (this._arraySize > 0) {
                    gl.uniform1iv(location, value);
                } else {
                    if (locationPrefix || (this._numericValue !== value)) {
                        gl.uniform1i(location, value);
                        this._numericValue = value;
                    }
                }
                break;
            case ShaderVariableType.BOOL:
                if (this._arraySize > 0) {
                    gl.uniform1iv(location, value.map(intValueOfBool));
                } else {
                    numericValue = value ? 1 : 0;
                    if (locationPrefix || (this._numericValue !== numericValue)) {
                        gl.uniform1i(location, numericValue);
                        this._numericValue = numericValue;
                    }
                }
                break;
            case ShaderVariableType.STRUCT:
                if (this._arraySize > 0) {
                    // for structs, launch recursive assignment of members
                    for (i = 0; i < value.length; i++) {
                        for (j = 0; j < this._members.length; j++) {
                            if (value[i][this._members[j]._name] !== undefined) {
                                memberName = this._members[j]._name;
                                this._members[j].setConstantValue(contextName, gl, shader, value[i][memberName], this._name + "[" + i + "].");
                            }
                        }
                    }
                } else {
                    for (i = 0; i < this._members.length; i++) {
                        if (value[this._members[i]._name] !== undefined) {
                            memberName = this._members[i]._name;
                            this._members[i].setConstantValue(contextName, gl, shader, value[memberName], this._name + ".");
                        }
                    }
                }
                break;
            default:
                application.showError(
                        "Attempting to set uniform '" +
                        this._name +
                        "', but it has a type that cannot be handled! (" +
                        ((this._arraySize > 0) ?
                                ("array (" + this._arraySize + ") of ") :
                                "") +
                        this._type + ")");
        }
    };
    /**
     * Sets the value of the shader uniform in the specified GL context to the return value
     * of the passed value function. Passing a function makes sure whatever 
     * calculations need to take place, they are (can be) calculated right before 
     * the uniform assignment if necessary.
     * @param {String} contextName The managed GL context
     * @param {WebGLRenderingContext} gl
     * @param {ManagedShader} shader The shader which this uniform belongs to.
     * @param {Function} valueFunction The function to calculate the uniform value.
     * The return type of this function should be appropriate to the uniform type.
     * For structs, it needs to return an Object with properties which have names
     * equal to the names of the members of the struct and the values are of 
     * appropriate type for the corresponding member.
     * @param {String} locationPrefix For uniform struct members, this string has to
     * contain the prefix that needs to be appended before their name to get their
     * access string to grab their location from the GL context. E.g. for 
     * "lights[3].color", the name would be "color" and so the prefix should be
     * "lights[3]."
     */
    ShaderUniform.prototype.setValue = function (contextName, gl, shader, valueFunction, locationPrefix) {
        this.setConstantValue(contextName, gl, shader, valueFunction(), locationPrefix);
    };
    /**
     * Returns how many 4 component vectors does this uniform variable take (for counting shader requirements).
     * @returns {Number}
     */
    ShaderUniform.prototype.getVectorCount = function () {
        var result, i;
        if (this._type === ShaderVariableType.STRUCT) {
            result = 0;
            for (i = 0; i < this._members.length; i++) {
                result += this._members[i].getVectorCount();
            }
            return result;
        }
        return getVectorCount(this._type) * (this._arraySize || 1);
    };
    // ############################################################################################
    /**
     * @class A wrapper class that represents a WebGL vertex buffer object.
     * @param {String} name The name by which this buffer can be referred to.
     * @param {String} role The role of the data in this buffer (e.g. position, 
     * normal, color)
     * @param {Number} vectorSize The number of components in one element of te VBO.
     * @param {Number} numVectors Number of vectors in this buffer.
     */
    function VertexBuffer(name, role, vectorSize, numVectors) {
        /**
         * The name by which this buffer can be referred to. The buffer will be
         * bound to vertex attributes having the same name.
         * @type String
         */
        this._name = name;
        /**
         * The usage role of the data stored in this buffer. This will determine
         * what data this buffer gets filled when grabbing the data from the 3D
         * model resources
         * @type String.
         */
        this._role = role;
        /**
         * The number of (Float32) components in one item of this buffer. E.g. for
         * buffer storing vec2 elements, set to 2.
         * @type Number
         */
        this._vectorSize = vectorSize;
        /**
         * The actual data stored in this buffer.
         * @type Float32Array
         */
        this._data = new Float32Array(numVectors * this._vectorSize);
        /**
         * The WebGL handles for this vertex buffer object.
         * @type Object.<String, WebGLBuffer>
         */
        this._ids = {};
        /**
         * The associative array of the locations (vertex attribute indices) of 
         * this vertex buffer associated with different shaders. The keys are the
         * names of the shaders, and the values are the indices of the vertex
         * attribute that is associated with the data in this vertex buffer in that
         * shader.
         * @type Object
         */
        this._locations = {};
        /**
         * The number of vectors that have been progressively filled in the data array using addVector().
         * @type Number
         */
        this._filledVectors = 0;
    }
    /**
     * Returns the name of this vertex buffer.
     * @returns {String}
     */
    VertexBuffer.prototype.getName = function () {
        return this._name;
    };
    /**
     * Returns the role that the data in this buffer fulfills. (e.g. location
     * or color)
     * @returns {String}
     */
    VertexBuffer.prototype.getRole = function () {
        return this._role;
    };
    /**
     * Sets (overwrites) a part of the data array of this buffer (before sending it 
     * to the GPU memory)
     * @param {Float32Array} data The data to be assigned.
     * @param {Number} start The index of the first vector to be assigned. Starting
     * from this, the data as long as the length of 'data' parameter will be 
     * overwritten.
     */
    VertexBuffer.prototype.setData = function (data, start) {
        this._data.set(data, start * this._vectorSize);
    };
    /**
     * Returns the number of vectors this buffer is currently able to store.
     * @returns {Number}
     */
    VertexBuffer.prototype.getSize = function () {
        return this._data.length / this._vectorSize;
    };
    /**
     * Erases the current content and sets a new size for this buffer.
     * @param {Number} size The new number of vectors the buffer should be able to store.
     */
    VertexBuffer.prototype.resize = function (size) {
        this._data = new Float32Array(size * this._vectorSize);
    };
    /**
     * Using this method, the data array can be filled progressively, with one vector each time.
     * @param {Number[]|Float32Array} vector A float vector to be added to the array. Needs to be _vectorSize long.
     */
    VertexBuffer.prototype.addVector = function (vector) {
        this._data.set(vector, this._filledVectors * this._vectorSize);
        this._filledVectors++;
    };
    /**
     * After calling this method, the buffer data can be filled again from the beginning using addVector().
     */
    VertexBuffer.prototype.resetFilledVectors = function () {
        this._filledVectors = 0;
    };
    /**
     * Frees the data stored in the normal RAM (for use after it is already in GPU 
     * memory)
     */
    VertexBuffer.prototype.freeData = function () {
        this._data = null;
    };
    /**
     * Creates the needed VBO in the supplied context and sends over the data (set
     * by setData) using it to the GPU, then erases the original data array. (unless otherwise specified)
     * @param {String} contextName
     * @param {WebGLRenderingContext} gl
     * @param {Boolean} [keepData=false] If true, the stored data is not erased.
     */
    VertexBuffer.prototype.loadToGPUMemory = function (contextName, gl, keepData) {
        this._ids[contextName] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this._ids[contextName]);
        gl.bufferData(
                gl.ARRAY_BUFFER,
                this._data,
                gl.STATIC_DRAW);
        if (!keepData) {
            this.freeData();
        }
    };
    /**
     * Binds the vertex buffer to the vertex attribute that has the same name as
     * this buffer (but only if needed because it is bound to a different index at 
     * the moment) within the passed shader and context and also enables the
     * corresponding vertex attribute array.
     * @param {ManagedGLContext} context
     * @param {ManagedShader} shader
     * @param {Boolean} [instanced=false] Whether to bind this buffer as an instance attribute buffer rather than a vertex attribute buffer
     * for instancing.
     */
    VertexBuffer.prototype.bind = function (context, shader, instanced) {
        if ((this._locations[shader.getName()] === undefined) || (this._locations[shader.getName()] === -1)) {
            this._locations[shader.getName()] = context.gl.getAttribLocation(shader.getIDForContext(context.getName()), this._name);
        }
        var location = this._locations[shader.getName()];
        if ((location >= 0) && (context.getBoundVertexBuffer(location) !== this)) {
            application.log("Binding " + (instanced ? "instance" : "vertex") + " buffer '" + this._name + "' to attribute location " + location + " in shader '" + shader.getName() + "'.", 3);
            if (instanced) {
                this.loadToGPUMemory(context.getName(), context.gl, true);
            } else {
                context.gl.bindBuffer(context.gl.ARRAY_BUFFER, this._ids[context.getName()]);
            }
            if (!context.getBoundVertexBuffer(location)) {
                context.gl.enableVertexAttribArray(location);
            }
            context.gl.vertexAttribPointer(location, this._vectorSize, context.gl.FLOAT, false, 0, 0);
            if (context.instancingExt) {
                if (instanced) {
                    context.instancingExt.vertexAttribDivisorANGLE(location, 1);
                } else {
                    context.instancingExt.vertexAttribDivisorANGLE(location, 0);
                }
            }
            context.setBoundVertexBuffer(location, this);
        }
    };
    /**
     * Deletes the corresponding WebGL buffer object.
     * @param {ManagedGLContext} context
     */
    VertexBuffer.prototype.delete = function (context) {
        var shaderName, location;
        context.gl.deleteBuffer(this._ids[context.getName()]);
        for (shaderName in this._locations) {
            if (this._locations.hasOwnProperty(shaderName)) {
                location = this._locations[shaderName];
                if (context.getBoundVertexBuffer(location) === this) {
                    context.setBoundVertexBuffer(location, null);
                    context.gl.disableVertexAttribArray(location);
                }
            }
        }
        delete this._ids[context.getName()];
        if (Object.keys(this._ids).length === 0) {
            this.freeData();
            this._locations = {};
        }
    };
    // ############################################################################################
    /**
     * @class A wrapper class around a WebGL Frame Buffer Object (FBO) for managed
     * functionality.
     * @param {String} name The name of the buffer to be created and later be referred to.
     * @param {Number} width The width of the frame buffer. (pixels/texels)
     * @param {Number} height The height of the frame buffer. (pixels/texels)
     * @param {Boolean} [depthOnly=false] If true and depth textures are supported, then only a depth texture will be attached to this 
     * framebuffer object.
     * @returns {FrameBuffer}
     */
    function FrameBuffer(name, width, height, depthOnly) {
        /**
         * The name by which this buffer can be referred to.
         * @type String
         */
        this._name = name;
        /**
         * The WebGL handle for this frame buffer object.
         * @type WebGLBuffer
         */
        this._id = null;
        /**
         * The width in pixels/texels.
         * @type Number
         */
        this._width = width;
        /**
         * The height in pixels/texels.
         * @type Number
         */
        this._height = height;
        /**
         * If true and depth textures are supported, then only a depth texture will be attached to this framebuffer object.
         * @type Boolean
         */
        this._depthOnly = !!depthOnly;
        /**
         * The WebGL handle for the texture object created for this buffer's color
         * attachment.
         * @type WebGLTexture
         */
        this._textureID = null;
        /**
         * The index of the texture unit the texture of this buffer's color attachment
         * was / should be bound to.
         * @type Number
         */
        this._textureLocation = this.TEXTURE_LOCATION_NOT_SET;
        /**
         * The WebGL handle for the render buffer object created for this buffer's
         * depth attachment.
         * @type WebGLRenderBuffer
         */
        this._renderBufferID = null;
    }
    /**
     * Value for texture bind locations that have not been explicitly set
     * @constant
     * @type Number
     */
    FrameBuffer.prototype.TEXTURE_LOCATION_NOT_SET = -1;
    /**
     * Returns the name of this buffer.
     * @returns {String}
     */
    FrameBuffer.prototype.getName = function () {
        return this._name;
    };
    /**
     * Returns the texture unit index where the texture associated with this 
     * framebuffer has been last bound to.
     * @returns {Number}
     */
    FrameBuffer.prototype.getLastTextureBindLocation = function () {
        return this._textureLocation;
    };
    /**
     * Erases the stored texture unit index corresponding to the last binding location of the texture of this framebuffer.
     */
    FrameBuffer.prototype.forgetLastTextureBindLocation = function () {
        this._textureLocation = this.TEXTURE_LOCATION_NOT_SET;
    };
    /**
     * Creates the WebGL frame buffer object for this buffer, then creates and 
     * sets up a texture for holding the color attachment and a render buffer 
     * for holding the depth attachment and attaches them to this frame buffer.
     * @param {ManagedGLContext} context
     */
    FrameBuffer.prototype.setup = function (context) {
        // calling setup on a frame buffer that has already been set up has no effect
        if (this._id) {
            return;
        }
        this._id = context.gl.createFramebuffer();
        context.gl.bindFramebuffer(context.gl.FRAMEBUFFER, this._id);
        this._textureID = context.gl.createTexture();
        this._textureLocation = context.bindTexture(this);
        context.gl.texParameteri(context.gl.TEXTURE_2D, context.gl.TEXTURE_MAG_FILTER, context.gl.NEAREST);
        context.gl.texParameteri(context.gl.TEXTURE_2D, context.gl.TEXTURE_MIN_FILTER, context.gl.NEAREST);
        if (this._depthOnly && context.areDepthTexturesAvailable()) {
            context.gl.texImage2D(context.gl.TEXTURE_2D, 0, context.gl.DEPTH_COMPONENT, this._width, this._height, 0, context.gl.DEPTH_COMPONENT, context.gl.UNSIGNED_SHORT, null);
            context.gl.framebufferTexture2D(context.gl.FRAMEBUFFER, context.gl.DEPTH_ATTACHMENT, context.gl.TEXTURE_2D, this._textureID, 0);
        } else {
            context.gl.texImage2D(context.gl.TEXTURE_2D, 0, context.gl.RGBA, this._width, this._height, 0, context.gl.RGBA, context.gl.UNSIGNED_BYTE, null);
            this._renderBufferID = context.gl.createRenderbuffer();
            context.gl.bindRenderbuffer(context.gl.RENDERBUFFER, this._renderBufferID);
            context.gl.renderbufferStorage(context.gl.RENDERBUFFER, context.gl.DEPTH_COMPONENT16, this._width, this._height);
            context.gl.framebufferTexture2D(context.gl.FRAMEBUFFER, context.gl.COLOR_ATTACHMENT0, context.gl.TEXTURE_2D, this._textureID, 0);
            context.gl.framebufferRenderbuffer(context.gl.FRAMEBUFFER, context.gl.DEPTH_ATTACHMENT, context.gl.RENDERBUFFER, this._renderBufferID);
        }
        switch (context.gl.checkFramebufferStatus(context.gl.FRAMEBUFFER)) {
            case context.gl.FRAMEBUFFER_COMPLETE:
                application.log("Framebuffer '" + this._name + "' successfully created.");
                break;
            case context.gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
                application.showGraphicsError("Incomplete status for framebuffer '" + this._name + "': The attachment types are mismatched or not all framebuffer attachment points are framebuffer attachment complete.");
                break;
            case context.gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
                application.showGraphicsError("Incomplete status for framebuffer '" + this._name + "': Attachment missing.");
                break;
            case context.gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
                application.showGraphicsError("Incomplete status for framebuffer '" + this._name + "': Height and width of the attachment are not the same.");
                break;
            case context.gl.FRAMEBUFFER_UNSUPPORTED:
                application.showGraphicsError("Incomplete status for framebuffer '" + this._name + "': The format of the attachment is not supported or depth and stencil attachments are not the same renderbuffer.");
                break;
            default:
                application.showGraphicsError("Unknown framebuffer status for '" + this._name + "'!");
        }
    };
    /**
     * Binds the frame buffer to the given context. Subsequent rendering will
     * use this frame buffer.
     * @param {ManagedGLContext} context
     */
    FrameBuffer.prototype.bind = function (context) {
        context.gl.bindFramebuffer(context.gl.FRAMEBUFFER, this._id);
    };
    /**
     * Binds the texture corresponding to this frame buffer object to the texture unit with the specified index.
     * @param {WebGLRenderingContext} gl
     * @param {Number} place
     */
    FrameBuffer.prototype.bindGLTexture = function (gl, place) {
        gl.activeTexture(gl.TEXTURE0 + place);
        gl.bindTexture(gl.TEXTURE_2D, this._textureID);
        this._textureLocation = place;
    };
    /**
     * Deletes the corresponding WebGL frame buffer object and the objects
     * associated with its attachments.
     * @param {ManagedGLContext} context
     */
    FrameBuffer.prototype.delete = function (context) {
        context.gl.deleteTexture(this._textureID);
        if (!this._depthOnly || !context.areDepthTexturesAvailable()) {
            context.gl.deleteRenderbuffer(this._renderBufferID);
        }
        context.gl.deleteFramebuffer(this._id);
        this._id = null;
    };
    // ############################################################################################
    /**
     * @typedef {Object} ManagedShader~ShaderRequirements
     * @property {Number} requiredVertexUniformVectors
     * @property {Number} requiredAttributeVectors
     * @property {Number} requiredVaryingVectors
     * @property {Number} requiredTextureUnits
     * @property {Number} requiredFragmentUniformVectors
     */
    /**
     * @class
     * @param {String} name
     * @param {String} vertexShaderSource
     * @param {String} fragmentShaderSource
     * @param {String} blendMode (enum ShaderBlendMode) 
     * @param {Object.<String, String>} vertexAttributeRoles
     * @param {Object.<String, String>} instanceAttributeRoles
     * @param {Object.<String, String} replacedDefines 
     */
    function ManagedShader(name, vertexShaderSource, fragmentShaderSource, blendMode, vertexAttributeRoles, instanceAttributeRoles, replacedDefines) {
        // properties for file resource management
        /**
         * The name of the shader program it can be referred to with later. Has to
         * be unique.
         * @type String
         */
        this._name = name;
        /**
         * (enum ShaderBlendMode) 
         * The type of blending to be used with this shader.
         * @type String
         */
        this._blendMode = blendMode;
        /**
         * The list of vertex attribute properties of this shader.
         * @type ShaderAttribute[]
         */
        this._vertexAttributes = [];
        /**
         * The list of instance attribute properties of this shader.
         * @type ShaderAttribute[]
         */
        this._instanceAttributes = [];
        /**
         * The list of shader uniforms of this shader.
         * @type ShaderUniform[]
         */
        this._uniforms = [];
        /**
         * The source code of the vertex shader.
         * @type String
         */
        this._vertexShaderSource = vertexShaderSource;
        /**
         * The source code of the fragment shader.
         * @type String
         */
        this._fragmentShaderSource = fragmentShaderSource;
        // properties for WebGL resource management
        /**
         * The associative array of WebGL program IDs belonging to managed contexts 
         * which this program has been associated with. The keys are the names of the managed
         * contexts, and values are the WebGL IDs (handles)
         * @type Object
         */
        this._ids = {};
        /**
         * The array of objects storing the instance attribute buffers organized by their names. Each element of the array stores the buffers
         * for one instance queue.
         * @type Array.<Object.<String, VertexBuffer>>
         */
        this._instanceAttributeBuffers = [];
        /**
         * The names of uniform variables that are replaced by instance attributes, if the shader is instanced, organized by the names of
         * instance attributes they are replaced by.
         * @type Object.<String, String>
         */
        this._uniformNamesForInstanceAttributeNames = instanceAttributeRoles;
        /**
         * The numver of 4 component vectors used up by the uniforms in the vertex shader.
         * @type Number
         */
        this._numVertexUniformVectors = 0;
        /**
         * The numver of 4 component vectors used up by the attributes in the vertex shader.
         * @type Number
         */
        this._numAttributeVectors = 0;
        /**
         * The numver of 4 component vectors used up by the varyings in the fragment shader.
         * @type Number
         */
        this._numVaryingVectors = 0;
        /**
         * The number of texture units used up by the uniforms in the fragment shader.
         * @type Number
         */
        this._numTextureUnits = 0;
        /**
         * The numver of 4 component vectors used up by the uniforms in the fragment shader.
         * @type Number
         */
        this._numFragmentUniformVectors = 0;
        this._parseShaderSources(vertexAttributeRoles, replacedDefines);
    }
    /**
     * @param {String} name
     * @returns {Boolean}
     */
    ManagedShader.prototype._hasUniform = function (name) {
        var i;
        for (i = 0; i < this._uniforms.length; i++) {
            if (this._uniforms[i].getName() === name) {
                return true;
            }
        }
        return false;
    };
    /**
     * Returns the uniform belonging to this shader having the passed name.
     * @param {String} name
     * @returns {ShaderUniform}
     */
    ManagedShader.prototype._getUniform = function (name) {
        var i;
        for (i = 0; i < this._uniforms.length; i++) {
            if (this._uniforms[i].getName() === name) {
                return this._uniforms[i];
            }
        }
        return null;
    };
    /**
     * @param {Object.<String, String>} attributeRoles The associative array binding the attribute names in the shader source to their roles
     * (which determines what kind of data will be bound to the respective attribute array). Format: {attributeName: attributeRole, ...}
     * @param {Object.<String, String>} [replacedDefines] Values defined in the shader source using #define will be replaced by the values
     * provided in this object (e.g. #define CONST 3 will be changed to #define CONST 5 if {CONST: 5} is passed.
     */
    ManagedShader.prototype._parseShaderSources = function (attributeRoles, replacedDefines) {
        var
                VERTEX_SHADER_INDEX = 0,
                FRAGMENT_SHADER_INDEX = 1,
                i, k, shaderType,
                sourceLines, words, delimiters, index,
                attributeName, attributeSize, attributeRole,
                uniform, uniformName, variableType, variableArraySize, arraySizeString,
                defines = {}, sourceChanged, localVariableNames, localVariableSizes = {},
                isNotEmptyString = function (s) {
                    return s !== "";
                },
                isPrecisionQualifier = function (s) {
                    return (s === "highp") || (s === "mediump") || (s === "lowp");
                },
                isBuiltInGLSLType = function (s) {
                    return utils.getSafeEnumValue(ShaderVariableType, s, ShaderVariableType.NONE) !== ShaderVariableType.NONE;
                },
                addStructMembers = function (uniform, uniformType) {
                    var structFound, innerWords, j;
                    structFound = false;
                    for (j = 0; j < sourceLines.length; j++) {
                        innerWords = sourceLines[j].split(" ");
                        if (!structFound) {
                            if ((innerWords[0] === "struct") && (innerWords[1].split("{")[0] === uniformType)) {
                                structFound = true;
                            }
                        } else {
                            innerWords = innerWords.filter(isNotEmptyString);
                            if ((innerWords.length > 0) && (innerWords[innerWords.length - 1].split(";")[0] === "}")) {
                                break;
                            }
                            if (innerWords.length >= 2) {
                                uniform.addMember(new ShaderUniform(innerWords[1].split(";")[0], innerWords[0], 0));
                            }
                        }
                    }
                };
        for (shaderType = 0; shaderType < 2; shaderType++) {
            switch (shaderType) {
                case VERTEX_SHADER_INDEX:
                    sourceLines = this._vertexShaderSource.split("\n");
                    break;
                case FRAGMENT_SHADER_INDEX:
                    sourceLines = this._fragmentShaderSource.split("\n");
                    break;
            }
            sourceChanged = false;
            for (i = 0; i < sourceLines.length; i++) {
                if (sourceLines[i].length > 0) {
                    words = sourceLines[i].split(/\s+|[\(\)\[\]\{\}\+\?\-!<>=*\/\^\|\&,;]/);
                    delimiters = sourceLines[i].match(/\s+|[\(\)\[\]\{\}\+\?\-!<>=*\/\^\|\&,;]/g);
                    // parsing defines
                    if (words[0] === "#define") {
                        if (replacedDefines && (replacedDefines[words[1]] !== undefined)) {
                            defines[words[1]] = replacedDefines[words[1]];
                            if (words[2] !== replacedDefines[words[1]]) {
                                sourceLines[i] = sourceLines[i].replace(words[2], replacedDefines[words[1]]);
                                sourceChanged = true;
                            }
                        } else {
                            defines[words[1]] = words[2];
                        }
                    }
                    // parsing attributes
                    else if ((shaderType === VERTEX_SHADER_INDEX) && (words[0] === "attribute")) {
                        index = isPrecisionQualifier(words[1]) ? 3 : 2;
                        attributeName = words[index];
                        variableType = words[index - 1];
                        attributeSize = getFloatVectorSize(variableType);
                        attributeRole = attributeRoles[attributeName];
                        this._numAttributeVectors += getVectorCount(variableType);
                        if (attributeRole === undefined) {
                            if (this._uniformNamesForInstanceAttributeNames.hasOwnProperty(attributeName)) {
                                attributeRole = this._uniformNamesForInstanceAttributeNames[attributeName];
                                this._instanceAttributes.push(new ShaderAttribute(attributeName, attributeSize, attributeRole));
                            } else {
                                application.showError("Role for attribute named '" + attributeName + "' not found for shader '" + this._name + "'!");
                                return;
                            }
                        } else {
                            this._vertexAttributes.push(new ShaderAttribute(attributeName, attributeSize, attributeRole));
                        }
                    }
                    // parsing uniforms
                    else if (words[0] === "uniform") {
                        index = isPrecisionQualifier(words[1]) ? 3 : 2;
                        uniformName = words[index];
                        variableType = words[index - 1];
                        if (this._hasUniform(uniformName) === false) {
                            if (delimiters[index] === "[") {
                                arraySizeString = words[index + 1];
                                if (defines[arraySizeString]) {
                                    arraySizeString = defines[arraySizeString];
                                }
                                variableArraySize = parseInt(arraySizeString, 10);
                            } else {
                                variableArraySize = 0;
                            }
                            if (!isBuiltInGLSLType(variableType)) {
                                uniform = new ShaderUniform(uniformName, "struct", variableArraySize);
                                addStructMembers(uniform, variableType);
                                this._uniforms.push(uniform);
                            } else {
                                this._uniforms.push(new ShaderUniform(uniformName, variableType, variableArraySize));
                            }
                        }
                        switch (shaderType) {
                            case VERTEX_SHADER_INDEX:
                                this._numVertexUniformVectors += this._getUniform(uniformName).getVectorCount();
                                break;
                            case FRAGMENT_SHADER_INDEX:
                                this._numFragmentUniformVectors += this._getUniform(uniformName).getVectorCount();
                                if (isTextureType(variableType)) {
                                    this._numTextureUnits += this._getUniform(uniformName).getVectorCount();
                                }
                                break;
                            default:
                                application.crash();
                        }
                    }
                    // parsing varyings
                    else if (words[0] === "varying") {
                        index = isPrecisionQualifier(words[1]) ? 3 : 2;
                        variableType = words[index - 1];
                        if (shaderType === FRAGMENT_SHADER_INDEX) {
                            if (delimiters[index] === "[") {
                                arraySizeString = words[index + 1];
                                if (defines[arraySizeString]) {
                                    arraySizeString = defines[arraySizeString];
                                }
                                variableArraySize = parseInt(arraySizeString, 10);
                            } else {
                                variableArraySize = 1;
                            }
                            this._numVaryingVectors += getVectorCount(variableType) * variableArraySize;
                        }
                    }
                    // parsing array sizes of local variables
                    else {
                        index = 0;
                        while (words[index] === "") {
                            index++;
                        }
                        if (isBuiltInGLSLType(words[index]) || isPrecisionQualifier(words[index])) {
                            index = isPrecisionQualifier(words[index]) ? index + 2 : index + 1;
                            if (delimiters[index] === "[") {
                                arraySizeString = words[index + 1];
                                if (defines[arraySizeString]) {
                                    arraySizeString = defines[arraySizeString];
                                }
                                localVariableSizes[words[index]] = parseInt(arraySizeString, 10);
                            }
                        }
                        // removing lines wich access array variables out of bounds according to replaced defines
                        else {
                            for (k = 0; k < this._uniforms.length; k++) {
                                index = words.indexOf(this._uniforms[k].getName());
                                if (index >= 0) {
                                    if ((this._uniforms[k].getArraySize() > 0) && (delimiters[index] === "[")) {
                                        if ((parseInt(words[index + 1], 10).toString() === words[index + 1]) && (parseInt(words[index + 1], 10) >= this._uniforms[k].getArraySize())) {
                                            sourceLines[i] = "";
                                            sourceChanged = true;
                                            break;
                                        }
                                    }
                                }
                            }
                            localVariableNames = Object.keys(localVariableSizes);
                            for (k = 0; k < localVariableNames.length; k++) {
                                index = words.indexOf(localVariableNames[k]);
                                if (index >= 0) {
                                    if (delimiters[index] === "[") {
                                        if ((parseInt(words[index + 1], 10).toString() === words[index + 1]) && (parseInt(words[index + 1], 10) >= localVariableSizes[words[index]])) {
                                            sourceLines[i] = "";
                                            sourceChanged = true;
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            if (sourceChanged) {
                switch (shaderType) {
                    case VERTEX_SHADER_INDEX:
                        this._vertexShaderSource = sourceLines.join("\n");
                        break;
                    case FRAGMENT_SHADER_INDEX:
                        this._fragmentShaderSource = sourceLines.join("\n");
                        break;
                }
            }
        }
    };
    /**
     * Getter for the _name property.
     * @returns {String}
     */
    ManagedShader.prototype.getName = function () {
        return this._name;
    };
    /**
     * Returns the WebGL ID of this program valid in the managed context with the passed name.
     * Error checking is not performed - if there is no valid ID for this context,
     * it will return undefined.
     * @param {String} contextName
     * @returns {WebGLProgram}
     */
    ManagedShader.prototype.getIDForContext = function (contextName) {
        return this._ids[contextName];
    };
    /**
     * Returns the array of vertex attributes of this shader.
     * @returns {ShaderAttribute[]}
     */
    ManagedShader.prototype.getVertexAttributes = function () {
        return this._vertexAttributes;
    };
    /**
     * Returns the vertex attribute with the given name.
     * @param {String} name
     * @returns {ShaderAttribute}
     */
    ManagedShader.prototype.getVertexAttribute = function (name) {
        var i;
        for (i = 0; i < this._vertexAttributes.length; i++) {
            if (this._vertexAttributes[i].name === name) {
                return this._vertexAttributes[i];
            }
        }
        return null;
    };
    /**
     * Returns the instance attribute with the given name.
     * @param {String} name
     * @returns {ShaderAttribute}
     */
    ManagedShader.prototype.getInstanceAttribute = function (name) {
        var i;
        for (i = 0; i < this._instanceAttributes.length; i++) {
            if (this._instanceAttributes[i].name === name) {
                return this._instanceAttributes[i];
            }
        }
        return null;
    };
    /**
     * Using the passed rendering context, creates, compiles, and links the corresponding WebGL program and caches the locations of its
     * uniforms so it will be ready to use.
     * @param {String} contextName
     * @param {WebGLRenderingContext} gl
     */
    ManagedShader.prototype.setupGLProgram = function (contextName, gl) {
        var vertexShader, infoLog, fragmentShader, prog, i;
        // create and compile vertex shader
        vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, this._vertexShaderSource);
        gl.compileShader(vertexShader);
        // detect and display compilation errors
        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            infoLog = gl.getShaderInfoLog(vertexShader);
            application.showGraphicsError("Compiling GLSL vertex shader of '" + this._name + "' failed.", application.ErrorSeverity.SEVERE, "More details:\n" + infoLog, gl);
            this._ids[contextName] = null;
            return;
        }
        // create and compile fragment shader
        fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, this._fragmentShaderSource);
        gl.compileShader(fragmentShader);
        // detect and display compilation errors
        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            infoLog = gl.getShaderInfoLog(fragmentShader);
            application.showGraphicsError("Compiling GLSL fragment shader of '" + this._name + "' failed.", application.ErrorSeverity.SEVERE, "More details:\n" + infoLog, gl);
            this._ids[contextName] = null;
            return;
        }
        // create and link shader program
        this._ids[contextName] = gl.createProgram();
        prog = this._ids[contextName];
        gl.attachShader(prog, vertexShader);
        gl.attachShader(prog, fragmentShader);
        gl.linkProgram(prog);
        // detect and display linking errors
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            infoLog = gl.getProgramInfoLog(prog);
            application.showGraphicsError("Linking GLSL shader '" + this._name + "' failed.", application.ErrorSeverity.SEVERE, "More details: " + infoLog, gl);
            gl.deleteProgram(prog);
            this._ids[contextName] = null;
            return;
        }
        // cache uniform locations - this is necessary for simple uniforms before use
        for (i = 0; i < this._uniforms.length; i++) {
            this._uniforms[i].saveLocation(contextName, gl, this);
        }
    };
    /**
     * Returns the blend mode to be used when rendering with this shader.
     * @returns {String} enum ShaderBlendMode
     */
    ManagedShader.prototype.getBlendMode = function () {
        return this._blendMode;
    };
    /**
     * Assigns the uniforms that have an associated value function in 
     * uniformValueFunctions, by calculating the value using those functions.
     * @param {ManagedGLContext} context The context in which the assignment needs
     * to happen.
     * @param {Object} uniformValueFunctions An associative array containing 
     * functions to calculate the values of uniforms, with the names of the uniforms
     * as keys.
     */
    ManagedShader.prototype.assignUniforms = function (context, uniformValueFunctions) {
        var i;
        context.setCurrentShader(this);
        if (uniformValueFunctions) {
            for (i = 0; i < this._uniforms.length; i++) {
                if (uniformValueFunctions[this._uniforms[i].getName()] !== undefined) {
                    this._uniforms[i].setValue(context.getName(), context.gl, this, uniformValueFunctions[this._uniforms[i].getName()]);
                }
            }
        }
    };
    /**
     * Binds the appropriate vertex buffers to the indices of the vertex attributes that this shader has.
     * @param {ManagedGLContext} context
     */
    ManagedShader.prototype.bindVertexBuffers = function (context) {
        var i;
        for (i = 0; i < this._vertexAttributes.length; i++) {
            context.getVertexBuffer(this._vertexAttributes[i].name).bind(context, this);
        }
    };
    /**
     * If the shader has a uniform array variable with the given name, this will return the length
     * of that array, otherwise it will return 0.
     * @param {String} uniformName
     * @returns {Number}
     */
    ManagedShader.prototype.getUniformArrayLength = function (uniformName) {
        var i;
        for (i = 0; i < this._uniforms.length; i++) {
            if (this._uniforms[i].getName() === uniformName) {
                return this._uniforms[i].getArraySize();
            }
        }
        return 0;
    };
    /**
     * Returns what types of textures does this shader need to be bound, based on the names of its uniform sampler variables.
     * @returns {Array}
     */
    ManagedShader.prototype.getTextureTypes = function () {
        var i, textureType, result = [];
        for (i = 0; i < this._uniforms.length; i++) {
            textureType = this._uniforms[i].getTextureType();
            if (textureType) {
                result.push(textureType);
            }
        }
        return result;
    };
    /**
     * Returns the names of cubemaps this shader needs to be bound, based on the names of its uniform sampler variables.
     * @returns {Array}
     */
    ManagedShader.prototype.getCubemapNames = function () {
        var i, cubemapName, result = [];
        for (i = 0; i < this._uniforms.length; i++) {
            cubemapName = this._uniforms[i].getCubemapName();
            if (cubemapName) {
                result.push(cubemapName);
            }
        }
        return result;
    };
    /**
     * Creates instance buffers for all the instance attributes of this shader. The created buffers are saved at the given index and can be
     * accessed later using it, so that multiple instance queues using the same shader can be managed by giving them different indices.
     * @param {Number} index
     * @param {Number} instanceCount
     */
    ManagedShader.prototype.createInstanceBuffers = function (index, instanceCount) {
        var attributeName;
        // if we don't have a storage for this instane queue yet, grow the array
        if (this._instanceAttributeBuffers.length < index + 1) {
            this._instanceAttributeBuffers = this._instanceAttributeBuffers.concat(new Array(index - this._instanceAttributeBuffers.length + 1));
        }
        // for each instance attribute, a new buffer is created or the existing one is set up (so that when rendering a new frame, existing
        // buffers can be reused even if the indices for the instance queues change)
        for (attributeName in this._uniformNamesForInstanceAttributeNames) {
            if (this._uniformNamesForInstanceAttributeNames.hasOwnProperty(attributeName)) {
                if (!this._instanceAttributeBuffers[index]) {
                    this._instanceAttributeBuffers[index] = {};
                }
                if (!this._instanceAttributeBuffers[index][attributeName]) {
                    this._instanceAttributeBuffers[index][attributeName] = new VertexBuffer(
                            attributeName,
                            this._uniformNamesForInstanceAttributeNames[attributeName],
                            this.getInstanceAttribute(attributeName).size,
                            instanceCount);
                } else {
                    this._instanceAttributeBuffers[index][attributeName].resize(instanceCount);
                    this._instanceAttributeBuffers[index][attributeName].resetFilledVectors();
                }
            }
        }
    };
    /**
     * Adds the data of one instance to the instance buffers (of all instance attributes) at the given index, using the values of the 
     * uniforms the instance would have assigned if it was not rendered in instanced mode.
     * @param {Number} index
     * @param {Object.<String, Function>} uniformValueFunctions
     */
    ManagedShader.prototype.addDataToInstanceBuffers = function (index, uniformValueFunctions) {
        var attributeName, uniformName;
        for (attributeName in this._instanceAttributeBuffers[index]) {
            if (this._instanceAttributeBuffers[index].hasOwnProperty(attributeName)) {
                uniformName = this._instanceAttributeBuffers[index][attributeName].getRole();
                if (uniformValueFunctions.hasOwnProperty(uniformName)) {
                    this._instanceAttributeBuffers[index][attributeName].addVector(uniformValueFunctions[uniformName](true));
                }
            }
        }
    };
    /**
     * Sends the data to WebGL using the passed context from the instance buffers (of all indices) stored at the passed index as well as
     * binds them to the correct attribute locations and sets them to instanced.
     * @param {ManagedGLContext} context
     * @param {Number} index
     */
    ManagedShader.prototype.bindAndFillInstanceBuffers = function (context, index) {
        var attributeName;
        for (attributeName in this._instanceAttributeBuffers[index]) {
            if (this._instanceAttributeBuffers[index].hasOwnProperty(attributeName)) {
                this._instanceAttributeBuffers[index][attributeName].bind(context, this, true);
            }
        }
    };
    /**
     * Deletes all the stored instance buffers created for the passed context.
     * @param {Number} context
     */
    ManagedShader.prototype.deleteInstanceBuffers = function (context) {
        var i, attributeName;
        for (i = 0; i < this._instanceAttributeBuffers.length; i++) {
            for (attributeName in this._instanceAttributeBuffers[i]) {
                if (this._instanceAttributeBuffers[i].hasOwnProperty(attributeName)) {
                    this._instanceAttributeBuffers[i][attributeName].delete(context);
                }
            }
        }
        this._instanceAttributeBuffers = [];
    };
    /**
     * Deletes the underlying WebGL program object and erases the cached uniform locations associated with the passed context name.
     * @param {String} contextName
     * @param {WebGLRenderingContext} gl
     */
    ManagedShader.prototype.deleteGLProgram = function (contextName, gl) {
        var i;
        if (this._ids[contextName]) {
            // cache uniform locations
            for (i = 0; i < this._uniforms.length; i++) {
                this._uniforms[i].forgetLocations(contextName);
            }
            gl.deleteProgram(this._ids[contextName]);
            delete this._ids[contextName];
        }
    };
    /**
     * Returns whether this shader is guaranteed to be supported if the passed requirements are satisfied by the graphics driver.
     * @param {ManagedShader~ShaderRequirements} requirements
     * @returns {Boolean}
     */
    ManagedShader.prototype.isAllowedByRequirements = function (requirements) {
        return (this._numAttributeVectors <= requirements.requiredAttributeVectors) &&
                (this._numVertexUniformVectors <= requirements.requiredVertexUniformVectors) &&
                (this._numVaryingVectors <= requirements.requiredVaryingVectors) &&
                (this._numTextureUnits <= requirements.requiredTextureUnits) &&
                (this._numFragmentUniformVectors <= requirements.requiredFragmentUniformVectors);
    };
    // ############################################################################################
    /**
     * Creates a managed WebGL context for the given HTML5 canvas element.
     * @class Adds higher level management functions to the WebGLRenderingContext
     * class. {@link Texture}, {@link Cubemap}, {@link Shader} and
     * {@link Model} resources can be linked to it, and can set up the vertex
     * buffers according to the linked model resources.
     * @extends AsyncResource
     * @param {String} name The name of the context.
     * @param {HTMLCanvasElement} canvas The canvas for which the context is to be
     * created.
     * @param {Boolean} [antialiasing=false] Whether antialising should be turned on for
     * this context. If the WebGL implementation does not support antialiasing, this
     * will have no effect.
     * @param {String} filtering What kind of texture filtering should be used for
     * 2D textures. Supported values are: bilinear, trilinear, anisotropic (which
     * will be 4:1)
     * @param {Boolean} [supressAntialiasingError=false] If true, no error will be shown if antialiasing is requested but not supported.
     * @returns {ManagedGLContext}
     */
    function ManagedGLContext(name, canvas, antialiasing, filtering, supressAntialiasingError) {
        asyncResource.AsyncResource.call(this);
        /**
         * The name of the context by which it can be referred to.
         * @type String
         */
        this._name = name;
        /**
         * A reference to the canvas the context of which this object wraps.
         * @type HTMLCanvasElement
         */
        this._canvas = canvas;
        /**
         * The contained basic WebGL rendering context.
         * @type WebGLRenderingContext
         */
        this.gl = null;
        /**
         * Whether antialiasing is enabled for the WebGL context.
         * @type Boolean
         */
        this._antialiasing = (antialiasing === true);
        /**
         * What filtering is used for 2D textures. Supported values are: bilinear,
         * trilinear and anisotropic. Attempting to create the context with anisotropic
         * filtering will cause it to probe if the functionality is available, and will
         * set 4:1 anisotropic filtering up if so, otherwise revert back to trilinear
         * filtering.
         * @type String
         */
        this._filtering = null;
        /**
         * Holder for the handle of the anisotropic filter WebGL extension.
         * @type EXTTextureFilterAnisotropic
         */
        this.anisotropicFilterExt = null;
        /**
         * Holder for the handle of the ANGLE_instanced_arrays WebGL extension.
         * @type ANGLEInstancedArrays
         */
        this.instancingExt = null;
        /**
         * Holder for the handle of the WEBGL_depth_texture WebGL extension.
         * @type WebGLDepthTexture
         */
        this.depthTextureExt = null;
        /**
         * The list of associated shaders. This needs to be stored in order to bind
         * the vertex buffer objects to the corresponding attributes of the shaders
         * after the buffers are created. However, the shaders are created and 
         * managed using a {@link ResourceManager}, and this context only references 
         * them.
         * A VBO is created for each attribute with a different name and then bound
         * to its index, therefore attributes with tha same name contained in these
         * shaders must share the same index as well.
         * @type Shader[]
         */
        this._shaders = [];
        /**
         * The list of associated models. This needs to be stored in order to fill 
         * the vertex buffer objects with data from these models when the buffers 
         * are created. <br/>
         * The model objects are created and managed using a {@link ResourceManager}, 
         * and this context only references them.
         * @type Model[]
         */
        this._models = [];
        /**
         * The associative array of vertex buffer objects, stored by their names 
         * (which equal the names of their corresponding attributes) as the keys.
         * @type Object
         */
        this._vertexBuffers = null;
        /**
         * The list of the vertex buffer objects bound to each vertex attribute
         * array index. (the index in the array corresponds to the vertex attribute
         * array index)
         * @type VertexBuffer[]
         */
        this._boundVertexBuffers = [];
        /**
         * The associative array of frame buffer objects, stored by their names 
         * (which equal the names of their corresponding attributes) as the keys.
         * @type Object
         */
        this._frameBuffers = {};
        /**
         * A reference to the currently used shader in order to quickly dismiss 
         * calls that aim to set the same again.
         * @type ManagedShader
         */
        this._currentShader = null;
        /**
         * The stored value of the current (lastly set) blend mode (enum ShaderBlendMode)
         * @type String
         */
        this._currentBlendMode = null;
        /**
         * The stored value of the current (lastly set) color mask (Boolean[4])
         * @type Array
         */
        this._currentColorMask = null;
        /**
         * The stored value of the current (lastly set) depth mask
         * @type Boolean
         */
        this._currentDepthMask = false;
        /**
         * Whether blending is currently enabled for the wrapped GL context.
         * @type Boolean
         */
        this._blendingEnabled = false;
        /**
         * The list of textures added to this context.
         * @type (ManagedTexture|ManagedCubemap)[]
         */
        this._textures = [];
        /**
         * The list of references to the currently bound textures in order to 
         * quickly dismiss calls that aim to bind the same texture to the same place
         * again. The indices mark which texture unit index the texture is bound 
         * to.
         * @type {texture: (ManagedTexture|ManagedCubemap|Framebuffer), reserved: Boolean}[]
         */
        this._boundTextures = [];
        /**
         * The maximum number of simultaneously bound textures supported by the
         * WebGL implementation.
         * @type Number
         */
        this._maxBoundTextures = 0;
        /**
         * When all texture unit places has been taken, new textures will be bound
         * to this rotating index so that subsequent binds will not replace each other
         * on the same unit.
         * @type Number
         */
        this._nextTextureBindLocation = 0;
        /**
         * The maximum supported 2D texture size. Attempting to add a texture to
         * the context that is bigger should fail.
         * @type Number
         */
        this._maxTextureSize = 0;
        /**
         * The maximum supported cubemap texture size. Attempting to add a 
         * cubemap texture to the context that is bigger should fail.
         * @type Number
         */
        this._maxCubemapSize = 0;
        /**
         * The maximum supported render buffer size. Attempting to create a 
         * render buffer in the context that is bigger should fail.
         * @type Number
         */
        this._maxRenderbufferSize = 0;
        /**
         * The number of supported vertex attributes.
         * @type Number
         */
        this._maxVertexAttributes = 0;
        /**
         * The number of supported uniform vectors in the vertex shader.
         * @type Number
         */
        this._maxVertexShaderUniforms = 0;
        /**
         * The number of supported uniform vectors in the fragment shader.
         * @type Number
         */
        this._maxFragmentShaderUniforms = 0;
        /**
         * The number of supported varying vectors in shader programs.
         * @type Number
         */
        this._maxVaryings = 0;
        this._createContext(supressAntialiasingError);
        this.setFiltering(filtering);
    }
    ManagedGLContext.prototype = new asyncResource.AsyncResource();
    ManagedGLContext.prototype.constructor = ManagedGLContext;
    /**
     * Creates the underlying WebGL context and its extension objects. (the ones that are available)
     * @param {Boolean} [supressAntialiasingError=false] If true, no error will be shown if antialiasing is requested but not supported
     */
    ManagedGLContext.prototype._createContext = function (supressAntialiasingError) {
        var gl_, contextParameters;
        application.log("Initializing WebGL context...", 1);
        // -------------------------------------------------------------------------------------------------------
        // creating the WebGLRenderingContext
        contextParameters = {alpha: true, antialias: this._antialiasing};
        // some implementations throw an exception, others don't, but all return null
        // if the creation fails, so handle that case
        try {
            // Try to grab the standard context.
            this.gl = this._canvas.getContext("webgl", contextParameters);
        } catch (ignore) {
        }
        // if creating a normal context fails, fall back to experimental, but notify the user
        if (!this.gl) {
            application.log("Initializing a regular context failed, initializing experimental context...", 1);
            contextParameters.alpha = false;
            try {
                this.gl = this._canvas.getContext("experimental-webgl", contextParameters);
            } catch (ignore) {
            }
            if (!this.gl) {
                application.showError("Unable to initialize WebGL.",
                        application.ErrorSeverity.CRITICAL,
                        "It looks like your device, browser or graphics drivers do not " +
                        "support web 3D graphics. Make sure your browser and graphics " +
                        "drivers are updated to the latest version, and you are using " +
                        "a modern web browser (Firefox or Chrome are recommended).\n" +
                        "Please note that some phones or handheld devices do not have 3D " +
                        "web capabilities, even if you use the latest software.");
                return;
            }
            application.showError("Your device appears to only have experimental WebGL (web based 3D) support.",
                    undefined, "This application relies on 3D web features, and without full support, " +
                    "the graphics of the application might be displayed with glitches or not at all. " +
                    "If you experience problems, it is recommended to use lower graphics quality settings.");
        }
        gl_ = this.gl;
        if (this._antialiasing && !(gl_.getContextAttributes().antialias)) {
            if (!supressAntialiasingError) {
                application.showGraphicsError("Antialiasing is enabled in graphics settings but it is not supported.",
                        application.ErrorSeverity.MINOR,
                        "Your graphics driver, browser or device unfortunately does not support antialiasing. To avoid " +
                        "this error message showing up again, disable antialiasing in the graphics settings or try " +
                        "running the application in a different browser. Antialiasing will not work, but otherwise this " +
                        "error will have no consequences.", gl_);
            }
            this._antialiasing = false;
        }
        // -------------------------------------------------------------------------------------------------------
        // save the information about WebGL limits
        this._maxBoundTextures = gl_.getParameter(gl_.MAX_TEXTURE_IMAGE_UNITS);
        this._maxVertexTextures = gl_.getParameter(gl_.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
        this._maxTextureSize = gl_.getParameter(gl_.MAX_TEXTURE_SIZE);
        this._maxCubemapSize = gl_.getParameter(gl_.MAX_CUBE_MAP_TEXTURE_SIZE);
        this._maxRenderbufferSize = gl_.getParameter(gl_.MAX_RENDERBUFFER_SIZE);
        this._maxVertexAttributes = gl_.getParameter(gl_.MAX_VERTEX_ATTRIBS);
        this._maxVertexShaderUniforms = gl_.getParameter(gl_.MAX_VERTEX_UNIFORM_VECTORS);
        this._maxFragmentShaderUniforms = gl_.getParameter(gl_.MAX_FRAGMENT_UNIFORM_VECTORS);
        this._maxVaryings = gl_.getParameter(gl_.MAX_VARYING_VECTORS);
        application.log("WebGL context successfully created.\n" + this.getInfoString(), 1);
        // -------------------------------------------------------------------------------------------------------
        // initializing extensions
        // anisotropic filtering
        this.anisotropicFilterExt = gl_.getExtension("EXT_texture_filter_anisotropic");
        if (this.anisotropicFilterExt === null) {
            application.log("Anisotropic filtering not available.", 1);
        } else {
            application.log("Anisotropic filtering successfully initialized.", 1);
        }
        // instancing extension
        this.instancingExt = gl_.getExtension("ANGLE_instanced_arrays");
        if (this.instancingExt === null) {
            application.log("Instancing is not available, and so it will be disabled.", 1);
        } else {
            application.log("Instancing successfully initialized.", 1);
        }
        // depth textures
        this.depthTextureExt = gl_.getExtension("WEBGL_depth_texture");
        if (this.depthTextureExt === null) {
            application.log("Depth textures not available, and so will be disabled.", 1);
        } else {
            application.log("Depth texture extension successfully initialized.", 1);
        }
        // -------------------------------------------------------------------------------------------------------
        // some basic settings on the context state machine
        gl_.clearDepth(1.0);
        gl_.colorMask(true, true, true, true);
        this._currentColorMask = [true, true, true, true];
        gl_.depthMask(true);
        this._currentDepthMask = true;
        gl_.enable(gl_.BLEND);
        this._blendingEnabled = true;
        gl_.enable(gl_.DEPTH_TEST);
        gl_.depthFunc(gl_.LEQUAL);
        gl_.enable(gl_.CULL_FACE);
        gl_.cullFace(gl_.BACK);
        gl_.frontFace(gl_.CCW);
    };
    /**
     * Returns a string containing detailed information about the graphics support and driver limits of this context.
     * @returns {String}
     */
    ManagedGLContext.prototype.getInfoString = function () {
        return this.gl ?
                "WebGL version: " + this.gl.getParameter(this.gl.VERSION) + "\n" +
                "Shading language version: " + this.gl.getParameter(this.gl.SHADING_LANGUAGE_VERSION) + "\n" +
                "WebGL vendor: " + this.gl.getParameter(this.gl.VENDOR) + "\n" +
                "WebGL renderer: " + this.gl.getParameter(this.gl.RENDERER) + "\n" +
                "Available vertex shader uniform vectors: " + this._maxVertexShaderUniforms + "\n" +
                "Available vertex attributes: " + this._maxVertexAttributes + "\n" +
                "Available texture units in vertex shaders: " + this._maxVertexTextures + "\n" +
                "Available varying vectors: " + this._maxVaryings + "\n" +
                "Available fragment shader uniform vectors: " + this._maxFragmentShaderUniforms + "\n" +
                "Available texture units: " + this._maxBoundTextures + "\n" +
                "Maximum texture size: " + this._maxTextureSize + "\n" +
                "Maximum cubemap size: " + this._maxCubemapSize + "\n" +
                "Maximum renderbuffer size: " + this._maxRenderbufferSize
                :
                "N/A";
    };
    /**
     * Returns the name of this managed context.
     * @returns {String}
     */
    ManagedGLContext.prototype.getName = function () {
        return this._name;
    };
    /**
     * Returns whether antialiasing is used for this context.
     * @returns {Boolean}
     */
    ManagedGLContext.prototype.isAntialiased = function () {
        return this._antialiasing;
    };
    /**
     * Returns the type of currently set texture filtering.
     * @returns {String}
     */
    ManagedGLContext.prototype.getFiltering = function () {
        return this._filtering;
    };
    /**
     * Sets a new (minification) filtering mode and applies it to all textures that have been added to the context.
     * @param {String} value (enum TextureFiltering)
     */
    ManagedGLContext.prototype.setFiltering = function (value) {
        var i;
        value = utils.getSafeEnumValue(TextureFiltering, value, this._filtering);
        if (value !== this._filtering) {
            this._filtering = value;
            if (this._filtering === TextureFiltering.ANISOTROPIC) {
                if (!this.anisotropicFilterExt) {
                    application.log("Anisotropic filtering is set, but the required extension is not available. Trilinear filtering will be used.", 1);
                    this._filtering = TextureFiltering.TRILINEAR;
                }
            }
            for (i = 0; i < this._textures.length; i++) {
                if (this._textures[i].setMinFiltering) {
                    this.bindTexture(this._textures[i]);
                    this._textures[i].setMinFiltering(this.gl, this._filtering, this.anisotropicFilterExt);
                }
            }
        }
    };
    /**
     * Returns whether anisotropic filtering is supported for this context by the graphics driver.
     * @returns {Boolean}
     */
    ManagedGLContext.prototype.isAnisotropicFilteringAvailable = function () {
        return !!this.anisotropicFilterExt;
    };
    /**
     * Returns whether depth textures are supported for this context by the graphics driver.
     * @returns {Boolean}
     */
    ManagedGLContext.prototype.areDepthTexturesAvailable = function () {
        return !!this.depthTextureExt;
    };
    /**
     * Updates the color mask to be used for subsequent rendering, if needed.
     * @param {Boolean[4]} value Flags for the RGBA components - whether they should be updated when rendering.
     */
    ManagedGLContext.prototype.setColorMask = function (value) {
        if (this._currentColorMask[0] !== value[0] ||
                this._currentColorMask[1] !== value[1] ||
                this._currentColorMask[2] !== value[2] ||
                this._currentColorMask[3] !== value[3]) {
            this.gl.colorMask(value[0], value[1], value[2], value[3]);
            this._currentColorMask = value;
        }
    };
    /**
     * Updates the depth mask to be used for subsequent rendering, if needed.
     * @param {Boolean} value Whether the depth buffer should be updated when rendering.
     */
    ManagedGLContext.prototype.setDepthMask = function (value) {
        if (this._currentDepthMask !== value) {
            this.gl.depthMask(value);
            this._currentDepthMask = value;
        }
    };
    /**
     * Turns on blending for subsequent rendering calls.
     */
    ManagedGLContext.prototype.enableBlending = function () {
        if (!this._blendingEnabled) {
            this.gl.enable(this.gl.BLEND);
            this._blendingEnabled = true;
        }
    };
    /**
     * Turns off blending for subsequent rendering calls.
     */
    ManagedGLContext.prototype.disableBlending = function () {
        if (this._blendingEnabled) {
            this.gl.disable(this.gl.BLEND);
            this._blendingEnabled = false;
        }
    };
    /**
     * Adds the shader reference to the list of shaders to be used when the vertex
     * buffer objects are created and bound to shader attributes. (if needed)
     * @param {ManagedShader} shader
     */
    ManagedGLContext.prototype.addShader = function (shader) {
        if (this._shaders.indexOf(shader) < 0) {
            this._shaders.push(shader);
            shader.setupGLProgram(this._name, this.gl);
            this.resetReadyState();
        }
    };
    /**
     * Adds the model reference to the list of models to be used when the vertex
     * buffer objects are created and filled with data. 
     * @param {Model} model
     */
    ManagedGLContext.prototype.addModel = function (model) {
        if (this._models.indexOf(model) < 0) {
            this._models.push(model);
            this.resetReadyState();
        }
    };
    /**
     * Returns the vertex buffer with the given name, if such exists. Otherwise
     * returns undefined.
     * @param {String} name
     * @returns {VertexBuffer}
     */
    ManagedGLContext.prototype.getVertexBuffer = function (name) {
        return this._vertexBuffers[name];
    };
    /**
     * Adds the vertex buffer object given as parameter.
     * @param {VertexBuffer} vertexBuffer
     */
    ManagedGLContext.prototype.addVertexBuffer = function (vertexBuffer) {
        if (this._vertexBuffers[vertexBuffer.getName()] === undefined) {
            this._vertexBuffers[vertexBuffer.getName()] = vertexBuffer;
        }
    };
    /**
     * Returns the vertex buffer which is currently bound to the passed vertex
     * attribute index.
     * @param {Number} attributeLocation
     * @returns {VertexBuffer}
     */
    ManagedGLContext.prototype.getBoundVertexBuffer = function (attributeLocation) {
        return this._boundVertexBuffers[attributeLocation];
    };
    /**
     * Sets the vertex buffer as the currently bound buffer for the passed vertex
     * attribute index. (does not actually bind the buffer!)
     * @param {Number} attributeLocation
     * @param {VertexBuffer} vertexBuffer
     */
    ManagedGLContext.prototype.setBoundVertexBuffer = function (attributeLocation, vertexBuffer) {
        this._boundVertexBuffers[attributeLocation] = vertexBuffer;
    };
    /**
     * Passes the data to the stored vertex buffer objects.
     * @param {Object} data The data to store in the vertex buffers. It has to be
     * an associative array storing the Float32Arrays of the data organized by the
     * role (String) of the vertex buffer they are to be stored in as the key.
     * @param {Number} startIndex The starting index in the buffers from where to
     * set the data.
     */
    ManagedGLContext.prototype.setVertexBufferData = function (data, startIndex) {
        var vbName;
        for (vbName in this._vertexBuffers) {
            if (this._vertexBuffers.hasOwnProperty(vbName)) {
                if (data[this._vertexBuffers[vbName].getRole()] !== undefined) {
                    this._vertexBuffers[vbName].setData(data[this._vertexBuffers[vbName].getRole()], startIndex);
                }
            }
        }
    };
    /**
     * Based on the stored shader references, creates a vertex buffer object to each 
     * attribute with a unique name, fills them with data using the stored model
     * references and then binds the vertex buffer objects to the corresponding
     * attribute indices.
     */
    ManagedGLContext.prototype.setupVertexBuffers = function () {
        var i, j, vbName, sumVertices, vertexAttributes, bufferSize;
        if (this.isReadyToUse() === true) {
            return;
        }
        // delete possibly previously created buffers
        for (vbName in this._vertexBuffers) {
            if (this._vertexBuffers.hasOwnProperty(vbName)) {
                this._vertexBuffers[vbName].delete(this);
            }
        }
        // counting the number of vertices we need to put into the vertex buffers
        sumVertices = 0;
        for (i = 0; i < this._models.length; i++) {
            sumVertices = sumVertices + this._models[i].getBufferSize(this);
        }
        // creating and loading an index buffer (just with ascending numbers)
        // so that drawElements can also be used for rendering
        // this code can be useful later, when actual indexed rendering will be supported
        /*var indexBufferData = new Array(sumVertices);
         for (i = 0; i < sumVertices; i++) {
         indexBufferData[i] = i;
         }
         var indexBuffer = this.gl.createBuffer();
         this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
         this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexBufferData), this.gl.STATIC_DRAW);*/
        // creating a Float32Array of the appropriate size for each needed buffer
        this._vertexBuffers = {};
        for (i = 0; i < this._shaders.length; i++) {
            vertexAttributes = this._shaders[i].getVertexAttributes();
            for (j = 0; j < vertexAttributes.length; j++) {
                this.addVertexBuffer(new VertexBuffer(vertexAttributes[j].name, vertexAttributes[j].role, vertexAttributes[j].size, sumVertices));
            }
        }
        // filling the buffer data arrays from model data
        bufferSize = 0;
        for (i = 0; i < this._models.length; i++) {
            for (j = this._models[i].getMinLOD(); j <= this._models[i].getMaxLOD(); j++) {
                bufferSize += this._models[i].loadToVertexBuffers(this, bufferSize, j);
            }
        }
        // load the data to GPU memory and bind the attributes of the shaders with 
        // the corresponding VBOs
        for (vbName in this._vertexBuffers) {
            if (this._vertexBuffers.hasOwnProperty(vbName)) {
                this._vertexBuffers[vbName].loadToGPUMemory(this._name, this.gl);
            }
        }
        // bind the vertex buffers to the vertex attribute indices in each shader
        // and save this bindings for later use when a shader is selected
        this._currentShader = null;
        for (i = 0; i < this._shaders.length; i++) {
            this.setCurrentShader(this._shaders[i]);
        }
    };
    /**
     * Returns the frame buffer with the given name, if such exists. Otherwise
     * returns undefined.
     * @param {String} name
     * @returns {FrameBuffer}
     */
    ManagedGLContext.prototype.getFrameBuffer = function (name) {
        return this._frameBuffers[name];
    };
    /**
     * Adds the passed frame buffer objec to the managed context.
     * @param {FrameBuffer} frameBuffer
     */
    ManagedGLContext.prototype.addFrameBuffer = function (frameBuffer) {
        if (this._frameBuffers[frameBuffer.getName()] === undefined) {
            application.log("Adding new framebuffer '" + frameBuffer.getName() + "' to context (" + this._name + ")...", 2);
            this._frameBuffers[frameBuffer.getName()] = frameBuffer;
            if (this.isReadyToUse()) {
                this._frameBuffers[frameBuffer.getName()].setup(this);
            }
        }
    };
    /**
     * Sets up all the previously added frame buffers.
     */
    ManagedGLContext.prototype.setupFrameBuffers = function () {
        var fbName;
        if (this.isReadyToUse()) {
            return;
        }
        for (fbName in this._frameBuffers) {
            if (this._frameBuffers.hasOwnProperty(fbName)) {
                this._frameBuffers[fbName].setup(this);
            }
        }
    };
    /**
     * Deletes all the previously added frame buffers.
     */
    ManagedGLContext.prototype.clearFrameBuffers = function () {
        var fbName;
        for (fbName in this._frameBuffers) {
            if (this._frameBuffers.hasOwnProperty(fbName)) {
                this._frameBuffers[fbName].delete(this);
            }
        }
        this._frameBuffers = {};
    };
    /**
     * Does all preparations for the previously added resources (shader, models,
     * frame buffers...) that are needed to be able to start rendering. After 
     * this method, the context is ready to render any resources that have been 
     * added to it up to this point.
     */
    ManagedGLContext.prototype.setup = function () {
        application.log("Setting up context '" + this._name + "'...", 2);
        this.setupVertexBuffers();
        this.setupFrameBuffers();
        this.setToReady();
    };
    /**
     * Clears the stored state and the list of frame buffers of the managed context, but keeps the
     * added resources (textures, cubemaps, models, shaders)
     */
    ManagedGLContext.prototype.clear = function () {
        var i;
        application.log("Clearing context '" + this._name + "'...", 2);
        this.clearFrameBuffers();
        this._currentShader = null;
        for (i = 0; i < this._boundTextures.length; i++) {
            this.unbindTexture(this._boundTextures[i].texture);
        }
        this._boundTextures = [];
        for (i = 0; i < this._textures.length; i++) {
            this._textures[i].forgetLastTextureBindLocation(this._name);
        }
        for (i = 0; i < this._boundVertexBuffers.length; i++) {
            this.gl.disableVertexAttribArray(i);
        }
        this._boundVertexBuffers = [];
    };
    /**
     * Removes all the shader added to this managed context and deletes their underlying WebGL shaders.
     * @returns {undefined}
     */
    ManagedGLContext.prototype.removeShaders = function () {
        var i;
        for (i = 0; i < this._shaders.length; i++) {
            this._shaders[i].deleteInstanceBuffers(this);
            this._shaders[i].deleteGLProgram(this._name, this.gl);
        }
        this._shaders = [];
        this._currentShader = null;
    };
    /**
     * Sets the stored framebuffer with the passed name as the current framebuffer
     * to render to. If no name (or any falsy value) is given, sets the screen 
     * as the current rendering target.
     * @param {String} [name]
     */
    ManagedGLContext.prototype.setCurrentFrameBuffer = function (name) {
        if (name) {
            this._frameBuffers[name].bind(this);
        } else {
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        }
    };
    /**
     * Returns the currently set shader.
     * @returns {ManagedShader}
     */
    ManagedGLContext.prototype.getCurrentShader = function () {
        return this._currentShader;
    };
    /**
     * Sets up the provided shader for usage within the provided scene.
     * @param {ManagedShader} shader The shader to set as current.
     * @returns {Boolean} Whether the current shader has been changed as a result of this call
     */
    ManagedGLContext.prototype.setCurrentShader = function (shader) {
        var newBlendMode;
        if (this._currentShader !== shader) {
            application.log("Switching to shader: " + shader.getName(), 3);
            this.gl.useProgram(shader.getIDForContext(this._name));
            newBlendMode = shader.getBlendMode();
            switch (newBlendMode) {
                case ShaderBlendMode.MIX:
                    if (this._currentBlendMode !== newBlendMode) {
                        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
                        this._currentBlendMode = newBlendMode;
                    }
                    break;
                case ShaderBlendMode.ADD:
                    if (this._currentBlendMode !== newBlendMode) {
                        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE);
                        this._currentBlendMode = newBlendMode;
                    }
                    break;
                case ShaderBlendMode.NONE:
                    break;
                default:
                    application.crash();
            }
            shader.bindVertexBuffers(this);
            this._currentShader = shader;
            return true;
        }
        return false;
    };
    /**
     * Adds the passed texture to the list of associated textures, if needed. (so e.g. when the texture filtering mode for this context is 
     * changed, it will be changed for this texture as well)
     * @param {ManagedTexture|ManagedCubemap} texture
     */
    ManagedGLContext.prototype.addTexture = function (texture) {
        if (this._textures.indexOf(texture) < 0) {
            this._textures.push(texture);
            texture.createGLTexture(this._name, this.gl);
            this.bindTexture(texture);
            texture.setupGLTexture(this.gl, this._filtering, this.anisotropicFilterExt);
        }
    };
    /**
     * Binds the given {@link Texture} or {@link Cubemap} resource or the texture
     * associated to the given {@link FrameBuffer} resource to the given texture unit index.
     * @param {ManagedTexture|ManagedCubemap|FrameBuffer} texture The resource to bind for rendering.
     * @param {Number} place To which activeTexture place is the texture to be bound.
     * If omitted, the texture will be bound to any free unit if one is available, and 
     * to a unit with a rotating index, if no free units are available. If a specific
     * index is given, that index will be reserved for this texture, and will not be
     * automatically assigned during later binds.
     * @param {Boolean} reservePlace If true, an automatic index will be bound as if 
     * no index was specified, but that index will be reserved for the texture.
     * @return {Number} The texture unit index the texture was bound to.
     */
    ManagedGLContext.prototype.bindTexture = function (texture, place, reservePlace) {
        // if a specific place was given for the bind, reserve that 
        // (or the automatically found) place for this texture
        var reserved = (place !== undefined) || reservePlace;
        // if needed, determine the bind locaton automatically
        if (place === undefined) {
            // find out if there is a preferred bind location
            place = texture.getLastTextureBindLocation(this._name);
            // if there is no preferred location or another texture is bound to the preferred location,
            // find the first free place, and bind the texture there
            if ((place === undefined) || (place === FrameBuffer.prototype.TEXTURE_LOCATION_NOT_SET) || (this._boundTextures[place].texture !== texture)) {
                place = 0;
                while ((place < this._maxBoundTextures) && (place < this._boundTextures.length) && (this._boundTextures[place])) {
                    place++;
                }
                // if there is no free space left, bind to a rotating location, excluding the reserved
                // locations
                if (place === this._maxBoundTextures) {
                    while (this._boundTextures[this._nextTextureBindLocation].reserved) {
                        this._nextTextureBindLocation = (this._nextTextureBindLocation + 1) % this._maxBoundTextures;
                    }
                    place = this._nextTextureBindLocation;
                    this._nextTextureBindLocation = (this._nextTextureBindLocation + 1) % this._maxBoundTextures;
                }
            }
        }
        // only bind to it the given texture location if currenty it is unbound or a different texture is bound to it
        if (!this._boundTextures[place] || (this._boundTextures[place].texture !== texture)) {
            if (texture instanceof ManagedTexture) {
                application.log("Binding texture: '" + texture.getName() + "' to texture unit " + place + (reserved ? ", reserving place." : "."), 3);
                texture.bindGLTexture(this._name, this.gl, place);
            } else
            if (texture instanceof ManagedCubemap) {
                application.log("Binding cubemap texture: '" + texture.getName() + "' to texture unit " + place + (reserved ? ", reserving place." : "."), 3);
                texture.bindGLTexture(this._name, this.gl, place);
            } else
            if (texture instanceof FrameBuffer) {
                application.log("Binding framebuffer texture: '" + texture.getName() + "' to texture unit " + place + (reserved ? ", reserving place." : "."), 3);
                texture.bindGLTexture(this.gl, place);
            } else {
                application.showError("Cannot set object: '" + texture.toString() + "' as current texture, because it is not of an appropriate type.");
            }
            this._boundTextures[place] = {texture: texture, reserved: reserved};
        }
        // make sure the reserve state is updated even if no bind happened
        if (this._boundTextures[place].reserved !== reserved) {
            this._boundTextures[place].reserved = reserved;
            application.log((reserved ? "Reserved" : "Freed") + " texture unit index " + place + ".", 3);
        }
        return place;
    };
    /**
     * If the passed texture is currently bound to a texture unit, removes that binding.
     * @param {ManagedTexture|ManagedCubemap|Framebuffer} texture
     */
    ManagedGLContext.prototype.unbindTexture = function (texture) {
        var place = texture && texture.getLastTextureBindLocation(this._name);
        if ((place !== undefined) && (place >= 0) && (this._boundTextures[place] === texture)) {
            this.gl.activeTexture(this.gl.TEXTURE0 + place);
            this.gl.bindTexture(this.gl.TEXTURE_2D, null);
            this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, null);
            this._boundTextures[place] = null;
            texture.forgetLastTextureBindLocation(this._name);
        }
    };
    /**
     * Removes the passed texture if it has been added to the context before as well as deletes its underlying WebGL texture object.
     * @param {ManagedTexture|ManagedCubemap} texture
     */
    ManagedGLContext.prototype.removeTexture = function (texture) {
        var index = this._textures.indexOf(texture);
        if (index >= 0) {
            this.unbindTexture(texture);
            texture.deleteGLTexture(this._name, this.gl);
            this._textures.splice(index, 1);
        }
    };
    /**
     * Returns whether the graphics driver's support level satisfies the given requirements.
     * @param {ManagedShader~ShaderRequirements} requirements
     * @returns {Boolean}
     */
    ManagedGLContext.prototype.satisfiesRequirements = function (requirements) {
        return (this._maxVertexAttributes >= requirements.requiredAttributeVectors) &&
                (this._maxVertexShaderUniforms >= requirements.requiredVertexUniformVectors) &&
                (this._maxVaryings >= requirements.requiredVaryingVectors) &&
                (this._maxFragmentShaderUniforms >= requirements.requiredFragmentUniformVectors) &&
                (this._maxBoundTextures >= requirements.requiredTextureUnits);
    };
    /**
     * Returns the maximum size of textures supported by the graphics driver for this context.
     * @returns {Number}
     */
    ManagedGLContext.prototype.getMaxTextureSize = function () {
        return this._maxTextureSize;
    };
    /**
     * Returns the maximum size of cube mapped textures supported by the graphics driver for this context.
     * @returns {Number}
     */
    ManagedGLContext.prototype.getMaxCubemapSize = function () {
        return this._maxCubemapSize;
    };
    /**
     * Returns the maximum size of render buffers supported by the graphics driver for this context.
     * @returns {Number}
     */
    ManagedGLContext.prototype.getMaxRenderbufferSize = function () {
        return this._maxRenderbufferSize;
    };
    // -------------------------------------------------------------------------
    // Augmenting application
    /**
     * Displays information about an error that has occured in relation with WebGL,
     * adding some basic WebGL support info for easier troubleshooting.
     * @param {String} message A brief error message to show.
     * @param {String} [severity] (enum application.ErrorSeverity) The severity level of the error.
     * @param {String} [details] Additional details to show about the error,
     * with possible explanations or tips how to correct this error.
     */
    application.showGraphicsError = function (message, severity, details) {
        application.showError(message, severity, details + "\n\nThis is a graphics related error.\n" +
                "Information about your graphics support:\n" +
                _genericContext.getInfoString());
    };
    // -------------------------------------------------------------------------
    // Initizalization
    _genericContext = new ManagedGLContext("", document.createElement("canvas"), true, TextureFiltering.BILINEAR, true);
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        TextureFiltering: TextureFiltering,
        ShaderBlendMode: ShaderBlendMode,
        getUniformName: ShaderUniform.prototype.getUniformName,
        getTextureUniformRawName: ShaderUniform.prototype.getTextureUniformRawName,
        getCubemapUniformRawName: ShaderUniform.prototype.getCubemapUniformRawName,
        ManagedTexture: ManagedTexture,
        ManagedCubemap: ManagedCubemap,
        ManagedShader: ManagedShader,
        FrameBuffer: FrameBuffer,
        ManagedGLContext: ManagedGLContext,
        requirementsAreSatisfied: _genericContext.satisfiesRequirements.bind(_genericContext),
        getMaxTextureSize: _genericContext.getMaxTextureSize.bind(_genericContext),
        getMaxCubemapSize: _genericContext.getMaxCubemapSize.bind(_genericContext),
        getMaxRenderbufferSize: _genericContext.getMaxRenderbufferSize.bind(_genericContext),
        isAntialiasingAvailable: _genericContext.isAntialiased.bind(_genericContext),
        isAnisotropicFilteringAvailable: _genericContext.isAnisotropicFilteringAvailable.bind(_genericContext),
        areDepthTexturesAvailable: _genericContext.areDepthTexturesAvailable.bind(_genericContext)
    };
});