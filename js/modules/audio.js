/**
 * Copyright 2016 Krisztián Nagy
 * @file This module provides some wrappers for Web Audio API functions for easier use.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 0.1
 */

/*jslint nomen: true, white: true */
/*global define, AudioContext */

// some type hints for the current version of the web Audio API

/**
 * @callback AudioNode~connectFunction
 * @param {AudioNode} destination
 */

/**
 * @typedef {Object} AudioNode 
 * @property {AudioNode~connectFunction} connect
 */

/**
 * @typedef {AudioNode} AudioParam 
 * @property {Number} value
 */

/**
 * @typedef {Object} AudioBuffer
 */

/**
 * @typedef {AudioNode} AudioBufferSourceNode
 * @property {AudioBuffer} buffer
 * @property {Boolean} loop
 */

/**
 * @typedef {AudioNode} GainNode
 * @property {AudioParam} gain
 */

/**
 * @callback PannerNode~setPositionFunction
 * @param {Number} x
 * @param {Number} y
 * @param {Number} z
 */

/**
 * @typedef {AudioNode} PannerNode
 * @property {PannerNode~setPositionFunction} setPosition
 */

/**
 * @typedef {AudioNode} DynamicsCompressorNode
 */

/**
 * @callback AudioContext~createBufferSourceFunction
 * @returns {AudioBufferSourceNode}
 */

/**
 * @callback AudioContext~createGainFunction
 * @returns {GainNode}
 */

/**
 * @callback AudioContext~createPannerFunction
 * @returns {PannerNode}
 */

/**
 * @callback AudioContext~createDynamicsCompressorFunction
 * @returns {DynamicsCompressorNode}
 */

/**
 * @typedef {Object} AudioContext
 * @property {AudioContext~createBufferSourceFunction} createBufferSource
 * @property {AudioContext~createGainFunction} createGain
 * @property {AudioContext~createPannerFunction} createPanner
 * @property {AudioContext~createDynamicsCompressorFunction} createDynamicsCompressor
 */

/** 
 * @param application Used for showing error messages.
 */
define([
    "modules/application"
], function (application) {
    "use strict";
    var
            // ----------------------------------------------------------------------
            // Enums
            /**
             * @enum {Number}
             * When sound sources are created, they need to be put in one of these categories. Each category has a gain node at the end of 
             * the audio graph through which the volume of that category can be set individually. 
             * For simplicity there are only two static categories now, but in fact this could be generalized by allowing arbitrary string
             * IDs for categories and creating and connecting gain nodes for new categories on-the-fly.
             * @type Object
             */
            SoundCategory = {
                /**
                 * Attempting to play a sound in this category will result in an error - this is to prevent playing sounds with undefined
                 * category
                 */
                NOME: 0,
                /**
                 * A category for sound effects - typically short, possibly spatialized
                 */
                SOUND_EFFECT: 1,
                /**
                 * A category for songs to play - typically longer, not spatialized
                 */
                MUSIC: 2
            },
    // ----------------------------------------------------------------------
    // Private variables
    /**
     * Stores a reference to all the loaded buffers, organized by the names of the sound files they were loaded from - so that one
     * sound files is only loaded once.
     * @type Object
     */
    _buffers = {},
            /**
             * Used for setting the master volume for sound effects - all effect nodes are going through this.
             * @type GainNode
             */
            _effectGain,
            /**
             * Used for setting the master volume for music - all music nodes are going through this.
             * @type GainNode
             */
            _musicGain,
            /**
             * Used for setting the master volume for all sounds - all sound nodes are going through this.
             * @type GainNode
             */
            _masterGain,
            /**
             * Used for dynamic compression at the end of the audio graph.
             * @type DynamicsCompressorNode
             */
            _compressor,
            /**
             * A common sound source that is used to play sounds for which no persistent sound source needs to be created (to avoid creating
             * unnecessary objects) 
             * @type SoundSource
             */
            _source,
            /**
             * A reference the audio context of the API.
             * @type AudioContext
             */
            _context;
    // ##############################################################################
    /**
     * @class
     * A wrapper class that represents a persistent 2D or 3D sound source and is capable of playing its associated sound sample file from
     * a buffer and modify a few parameters of the playback by encapsulating a part of the audio graph for which it can create the nodes as
     * necessary.
     * @param {Number} soundCategory (enum SoundCategory) The category this sound belongs to
     * @param {String} sampleName The name of the sounds sample. Must be loaded for playback (loading is not  handled by this class), cannot
     * be changed later.
     * @param {Number} [volume=1] The volume at which to play the sound sample (in case of 3D sounds, at the reference distance: 1). Can be
     * modified later, but if omitted, no gain node will be added for this source, which means a volume of 1 that cannot be changed.
     * @param {Boolean} [loop=false] Whether the sound sample should be played in looping mode.
     * @param {Number[3]} [position] In case of a 3D spatialized sounds, the camera-space position of the sound. Can be modified later, but 
     * if omitted, no associated node will be created and the sound cannot be spatialized later.
     * @param {Number} [rolloffFactor=1] In case of 3D spatialized sounds, the factor to determine how loud the sound should be at a 
     * specific distance. The formula used: 1 / (1 + rolloffFactor * (d - 1)), where d is the distance (reverse mode with refDistance=1)
     */
    function SoundSource(soundCategory, sampleName, volume, loop, position, rolloffFactor) {
        /**
         * The category of this sound, allowing the user to set a separate master volume per category
         * @type Number
         */
        this._soundCategory = soundCategory;
        /**
         * The name of the sounds sample
         * @type String
         */
        this._sampleName = sampleName;
        /**
         * The current volume at which to play the sound sample 
         * @type Number
         */
        this._volume = volume;
        /**
         * Whether the sound sample should be played in looping mode
         * @type Boolean
         */
        this._loop = loop;
        /**
         * The world position of the sound source
         * @type Number[3]
         */
        this._position = position;
        /**
         * The factor to determine how loud the sound should be at a specific distance
         * @type Number
         */
        this._rolloffFactor = rolloffFactor;
        /**
         * A reference to the buffer source node used to play this sound
         * @type AudioBufferSourceNode
         */
        this._sourceNode = null;
        /**
         * A reference to the gain node attached to the source, used to control its volume
         * @type GainNode
         */
        this._gainNode = null;
        /**
         * A reference to the node used to control the spatial position of this sound
         * @type PannerNode
         */
        this._pannerNode = null;
        /**
         * A flag marking whether the playback of this sound is in progress
         * @type Boolean
         */
        this._playing = false;
    }
    /**
     * Sets a new volume for the sound source. Effective only if an initial volume was specified (even if it was 1.0)
     * @param {Number} volume
     */
    SoundSource.prototype.setVolume = function (volume) {
        this._volume = volume;
        if (this._gainNode) {
            this._gainNode.gain.value = volume;
        }
    };
    /**
     * Increases the volume of the sound source. Effective only if an initial volume was specified (even if it was 1.0)
     * @param {Number} amount
     */
    SoundSource.prototype.increaseVolume = function (amount) {
        this._volume += amount;
        if (this._gainNode) {
            this._gainNode.gain.value = this._volume;
        }
    };
    /**
     * Changes the volume of the sound source via a linear ramp
     * @param {Number} volume The target value to change to
     * @param {Number} duration The duration of the ramp, in seconds
     * @param {Boolean} [onlyIfDifferent=false] If true, then the ramp will not be applied in case a ramp is already in progress towards the
     * same value.
     */
    SoundSource.prototype.rampVolume = function (volume, duration, onlyIfDifferent) {
        if (this._gainNode && (!onlyIfDifferent || (this._volume !== volume))) {
            this._gainNode.gain.cancelScheduledValues(_context.currentTime);
            this._gainNode.gain.setValueAtTime(this._gainNode.gain.value, _context.currentTime);
            this._gainNode.gain.linearRampToValueAtTime(volume, _context.currentTime + duration);
        }
        this._volume = volume;
    };
    /**
     * Sets a new position for the sound source. Can be used only if an initial position was specified
     * @param {Number} x
     * @param {Number} y
     * @param {Number} z
     */
    SoundSource.prototype.setPosition = function (x, y, z) {
        this._position[0] = x;
        this._position[1] = y;
        this._position[2] = z;
        if (this._pannerNode) {
            this._pannerNode.setPosition(x, y, z);
        }
    };
    /**
     * Sets a new position for the sound source. Can be used only if an initial position was specified
     * @param {Number[3]} p
     */
    SoundSource.prototype.setPositionv = function (p) {
        this._position = p;
        if (this._pannerNode) {
            this._pannerNode.setPosition(p[0], p[1], p[2]);
        }
    };
    /**
     * Starts a new playback of the sound from this source. If a previous, non looping playback is in progress, the reference to it will be
     * dropped and the parameters of this class will control the new playback. If a looping playback is in progress, this method does 
     * nothing.
     * @param {Boolean} [restart=false] If true, the previous (last) playback from this sound will be stopped in case it is still playing
     * @param {Function} [onFinish] If given, this function will be executed when the sample finished its playback (for looping sounds, this
     * means when stop is called)
     */
    SoundSource.prototype.play = function (restart, onFinish) {
        var currentNode;
        if (_buffers[this._sampleName]) {
            if (this._playing) {
                if (this._loop) {
                    return;
                }
                if (restart) {
                    this.stopPlaying();
                }
            }
            this._sourceNode = _context.createBufferSource();
            this._sourceNode.buffer = _buffers[this._sampleName];
            this._sourceNode.onended = function () {
                this._playing = false;
                if (onFinish) {
                    onFinish();
                }
            }.bind(this);
            currentNode = this._sourceNode;
            if (this._volume !== undefined) {
                this._gainNode = _context.createGain();
                currentNode.connect(this._gainNode);
                currentNode = this._gainNode;
                this._gainNode.gain.value = this._volume;
            }
            if (this._loop) {
                this._sourceNode.loop = true;
            }
            if (this._position) {
                this._pannerNode = _context.createPanner();
                currentNode.connect(this._pannerNode);
                currentNode = this._pannerNode;
                this._pannerNode.refDistance = 1;
                this._pannerNode.rolloffFactor = this._rolloffFactor || 1;
                this._pannerNode.setPosition(this._position[0], this._position[1], this._position[2]);
            }
            switch (this._soundCategory) {
                case SoundCategory.SOUND_EFFECT:
                    currentNode.connect(_effectGain);
                    break;
                case SoundCategory.MUSIC:
                    currentNode.connect(_musicGain);
                    break;
                default:
                    application.showError("Cannot play sound '" + this._sampleName + "', because it has an unkown category: " + this._soundCategory);
            }
            this._playing = true;
            this._sourceNode.start(0);
        } else if (this._sampleName) {
            application.showError("Attempting to play back '" + this._sampleName + "', which is not loaded!");
        }
    };
    /**
     * Stops the playback of the sound (useful mostly for looping sounds)
     */
    SoundSource.prototype.stopPlaying = function () {
        if (this._sourceNode) {
            this._sourceNode.stop();
        }
    };
    /**
     * Returns whether the sound sample is currently being played.
     * @returns {Boolean}
     */
    SoundSource.prototype.isPlaying = function () {
        return this._playing;
    };
    // ----------------------------------------------------------------------
    // Public functions
    /**
     * Loads a sound sample to a buffer and saves a reference to it for future use.
     * @param {String} name The by which to save the sound sample (to be used later when playing back or creating sound sources for it)
     * @param {XMLHTTPRequest} request The request which was used to download the sound sample (it should contain the (encoded) sample in an
     * arraybuffer type response)
     * @param {Function} [successCallback] A function to execute if the decoding of the sample is successful
     * @param {Function} [failureCallback] A function to execute if the decoding of the sample fails
     */
    function loadSample(name, request, successCallback, failureCallback) {
        _context.decodeAudioData(request.response, function (buffer) {
            _buffers[name] = buffer;
            if (successCallback) {
                successCallback();
            }
        }, function () {
            application.showError("Decoding audio sample '" + name + "' failed!");
            if (failureCallback) {
                failureCallback();
            }
        });
    }
    /**
     * Plays back a loaded sound sample without creating a persistent sound source (or any reference) for it.
     * @param {String} sampleName The name of the sample to be played
     * @param {Number} [volume=1] The volume at which to play back the sample
     * @param {Number[3]} [position] The camera-space position of the sound source, in case the sound should be spatialized
     * @param {Number} [rolloffFactor=1] The rolloff factor of the sound in case it is spatialized. See SoundSource for how the volume is
     * calculated based on it
     */
    function playSound(sampleName, volume, position, rolloffFactor) {
        SoundSource.call(_source, SoundCategory.SOUND_EFFECT, sampleName, volume, false, position, rolloffFactor);
        _source.play();
    }
    /**
     * Sets a master volume applied to all sound effects.
     * @param {Number} value
     */
    function setEffectVolume(value) {
        _effectGain.gain.value = value;
    }
    /**
     * Sets a master volume applied to music.
     * @param {Number} value
     */
    function setMusicVolume(value) {
        _musicGain.gain.value = value;
    }
    /**
     * Sets a master volume applied to all sounds.
     * @param {Number} value
     */
    function setMasterVolume(value) {
        _masterGain.gain.value = value;
    }
    // -------------------------------------------------------------------------
    // Initizalization
    _context = new AudioContext();
    _compressor = _context.createDynamicsCompressor();
    _compressor.connect(_context.destination);
    _masterGain = _context.createGain();
    _masterGain.connect(_compressor);
    _effectGain = _context.createGain();
    _effectGain.connect(_masterGain);
    _musicGain = _context.createGain();
    _musicGain.connect(_masterGain);
    _source = new SoundSource();
    // -------------------------------------------------------------------------
    // Public interface
    return {
        SoundCategory: SoundCategory,
        SoundSource: SoundSource,
        loadSample: loadSample,
        playSound: playSound,
        setEffectVolume: setEffectVolume,
        setMusicVolume: setMusicVolume,
        setMasterVolume: setMasterVolume
    };
});
