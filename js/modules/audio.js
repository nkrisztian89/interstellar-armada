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
 * @callback AudioParam~linearRampToValueAtTimeFunction
 * @param {Number} value
 * @param {Number} endTime
 */

/**
 * @typedef {AudioNode} AudioParam 
 * @property {Number} value
 * @property {AudioParam~linearRampToValueAtTimeFunction} linearRampToValueAtTime
 * @returns {AudioParam} 
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
 * @property {AudioParam} positionX
 * @property {AudioParam} positionY
 * @property {AudioParam} positionZ
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
                MUSIC: 2,
                /**
                 * A category for sounds of the UI - typically short, not spatialized
                 */
                UI: 3
            },
            /**
             * @enum {String}
             * Encompasses the possible panning models for panner nodes
             * @type Object
             */
            PanningModel = {
                EQUAL_POWER: "equalpower",
                HRTF: "HRTF"
            },
            // ----------------------------------------------------------------------
            // Constants
            /**
             * When calling a ramp function without a duration parameter, this duration is used
             * @type Number
             */
            DEFAULT_RAMP_DURATION = 0.010,
            /**
             * When creating a sound source without a rolloff factor parameter, this value is used
             * @type Number
             */
            DEFAULT_ROLLOFF_FACTOR = 0.01,
            /**
             * When creating a sound source without a panning model given, this panning model is used
             * @type String
             */
            DEFAULT_PANNING_MODEL = PanningModel.EQUAL_POWER,
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
             * Used for setting the master volume for UI - all UI nodes are going through this.
             * @type GainNode
             */
            _uiGain,
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
             * A common sound clip that is used to play sounds for which no persistent sound clip needs to be created (to avoid creating
             * unnecessary objects) 
             * @type SoundClip
             */
            _clip,
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
     * Represents a 3D sound source that can be used to play sound clips positioned in 3D space according to the settings given for this
     * object.
     * @param {Number[3]} position The initial camera-space position of the sound source
     * @param {Number} [rolloffFactor=DEFAULT_ROLLOFF_FACTOR] The factor to determine how loud the sound should be at a 
     * specific distance. The formula used: 1 / (1 + rolloffFactor * (d - 1)), where d is the distance (reverse mode with refDistance=1)
     * @param {String} [panningModel=DEFAULT_PANNING_MODEL] (enum PanningModel) The panning model to use (see Web Audio API)
     */
    function SoundSource(position, rolloffFactor, panningModel) {
        /**
         * The camera-space position of the sound source
         * @type Number[3]
         */
        this._position = position ? position.slice() : null;
        /**
         * The factor to determine how loud the sound should be at a specific distance
         * @type Number
         */
        this._rolloffFactor = rolloffFactor || DEFAULT_ROLLOFF_FACTOR;
        /**
         * A reference to the node used to control the spatial position of this sound
         * @type PannerNode
         */
        this._pannerNode = null;
        /**
         * (enum PanningModel) See the Web Audio API
         * @type String
         */
        this._panningModel = panningModel || DEFAULT_PANNING_MODEL;
        /**
         * Associated sound clips organized by the names of the samples they play. This can be used
         * to stack clips - instead of adding multiple clips of the same sample at the same time or with
         * a short time difference, only one is added, and the others just increase its volume
         * @type Object.<String, SoundClip>
         */
        this._clips = {};
    }
    /**
     * If necessary, creates, and returns the AudioNode to which nodes can be connected to play their output at the 3D position determined
     * by this sound source.
     * @returns {PannerNode}
     */
    SoundSource.prototype.getNode = function () {
        if (!this._pannerNode) {
            this._pannerNode = _context.createPanner();
            this._pannerNode.panningModel = this._panningModel;
            this._pannerNode.refDistance = 1;
            this._pannerNode.rolloffFactor = this._rolloffFactor;
            this._pannerNode.setPosition(this._position[0], this._position[1], this._position[2]);
            this._pannerNode.connect(_effectGain);
        }
        return this._pannerNode;
    };
    /**
     * Sets a new position for the sound source. 
     * @param {Number} x
     * @param {Number} y
     * @param {Number} z
     */
    SoundSource.prototype.setPosition = function (x, y, z) {
        var currentTime;
        if ((x !== this._position[0]) || (y !== this._position[1]) || (z !== this._position[2])) {
            this._position[0] = x;
            this._position[1] = y;
            this._position[2] = z;
            if (this._pannerNode) {
                // if possible, ramp with a small interval to avoid clicks / pops resulting from abrupt changes
                // this requires more processing (AudioParam events), so only apply if the clip is not muted
                if ((this._pannerNode.positionX) && (!this._gainNode || (this._gainNode.gain.value > 0))) {
                    currentTime = _context.currentTime;
                    // avoid inserting new events if possible
                    if (this._pannerNode.positionX.value !== x) {
                        this._pannerNode.positionX.cancelScheduledValues(currentTime);
                        this._pannerNode.positionX.setValueAtTime(this._pannerNode.positionX.value, currentTime);
                        this._pannerNode.positionX.linearRampToValueAtTime(x, currentTime + DEFAULT_RAMP_DURATION);
                    }
                    if (this._pannerNode.positionY.value !== y) {
                        this._pannerNode.positionY.cancelScheduledValues(currentTime);
                        this._pannerNode.positionY.setValueAtTime(this._pannerNode.positionY.value, currentTime);
                        this._pannerNode.positionY.linearRampToValueAtTime(y, currentTime + DEFAULT_RAMP_DURATION);
                    }
                    if (this._pannerNode.positionZ.value !== z) {
                        this._pannerNode.positionZ.cancelScheduledValues(currentTime);
                        this._pannerNode.positionZ.setValueAtTime(this._pannerNode.positionZ.value, currentTime);
                        this._pannerNode.positionZ.linearRampToValueAtTime(z, currentTime + DEFAULT_RAMP_DURATION);
                    }
                    // if the clip is muted or the position AudioParams are not available, do the fallback
                } else {
                    this._pannerNode.setPosition(x, y, z);
                }
            }
        }
    };
    /**
     * Sets the stored sound clip reference associated with the passed (sample) name
     * @param {String} name
     * @param {SoundClip} clip
     */
    SoundSource.prototype.setClip = function (name, clip) {
        this._clips[name] = clip;
    };
    /**
     * Returns the sound clip associated with the passed name (if any)
     * @param {String} name
     * @returns {SoundClip}
     */
    SoundSource.prototype.getClip = function (name) {
        return this._clips[name];
    };
    /**
     * Removes the reference to the stored panner node (if any) and disconnects all other nodes from the panner node
     */
    SoundSource.prototype.destroy = function () {
        if (this._pannerNode) {
            this._pannerNode.disconnect();
        }
        this._pannerNode = null;
    };
    // ##############################################################################
    /**
     * @class
     * Can be used to play a specific sound sample using the Web Audio API. Can be connected to a SoundSource to position the sound in 3D
     * space or used on its own to simply play it at a desired volume.
     * @param {Number} soundCategory (enum SoundCategory) The category this sound belongs to
     * @param {String} sampleName The name of the sounds sample. Must be loaded for playback (loading is not  handled by this class), cannot
     * be changed later.
     * @param {Number} [volume=1] The volume at which to play the sound sample (in case of 3D sounds, at the reference distance: 1). Can be
     * modified later, but if omitted, no gain node will be added for this source, which means a volume of 1 that cannot be changed.
     * @param {Boolean} [loop=false] Whether the sound sample should be played in looping mode.
     * @param {Boolean} [shouldStack=false] If true, whenever the clip is set to play at an associated sound source, 
     * the sound source will be checked for clips of the same sample, and this clip will be stacked if possible
     * @param {Number} [stackTimeThreshold=0] The time threshold for stacking (maximum time difference, in seconds)
     * @param {Number} [stackVolumeFactor=1] The factor to multiply the volume of stacked sound clips by
     * @param {SoundSource} [soundSource] The (spatial) sound source that emits this clip (category must be sound effect), to position it
     * in 3D
     */
    function SoundClip(soundCategory, sampleName, volume, loop, shouldStack, stackTimeThreshold, stackVolumeFactor, soundSource) {
        /**
         * (enum SoundCategory) The category of this sound, allowing the user to set a separate master volume per category
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
         * If true, whenever the clip is set to play at an associated sound source, the sound source 
         * is checked for clips of the same sample, and this clip will be stacked if possible
         * @type Boolean
         */
        this._shouldStack = shouldStack || false;
        /**
         * If set to stack, the clip will be stacked only if the play time difference between it and the 
         * other clip is less than this amount, in seconds
         * @type Number
         */
        this._stackTimeThreshold = stackTimeThreshold || 0;
        /**
         * When stacking this clip on top of another, the volume increase will be multiplied by this factor
         * @type Number
         */
        this._stackVolumeFactor = stackVolumeFactor || 1;
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
         * The timestamp of the moment the sample started playing (AudioContext.currentTime)
         * @type Number
         */
        this._playbackStartTime = 0;
        /**
         * A flag marking whether the playback of this sound is in progress
         * @type Boolean
         */
        this._playing = false;
        /**
         * The function to execute whenever the playback of the sample stops / finishes
         * @type Function
         */
        this._onFinish = null;
        /**
         * The associated sound source to position this clip in 3D
         * @type SoundSource
         */
        this._soundSource = null;
        if (soundSource) {
            this.setSource(soundSource);
        }
    }
    /**
     * Sets a sound source to be used for spatial 3D positioning of this clip - can only be used once, and only on sounds that have the
     * sound effect category!
     * @param {SoundSource} value
     */
    SoundClip.prototype.setSource = function (value) {
        if (this._soundCategory !== SoundCategory.SOUND_EFFECT) {
            application.showError("Cannot set sound source for clip '" + this._sampleName + "', because its sound category is not sound effect!");
        } else if (this._soundSource) {
            application.showError("Cannot set sound source for clip '" + this._sampleName + "', because it already has a source!");
        } else if (this._playing) {
            application.showError("Cannot set sound source for clip '" + this._sampleName + "', because it is already playing!");
        } else {
            this._soundSource = value;
        }
    };
    /**
     * Returns the volume currently set for this clip (the actual playback volume might be ramping towards this)
     * @returns {Number}
     */
    SoundClip.prototype.getVolume = function () {
        return (this._volume !== undefined) ? this._volume : 1;
    };
    /**
     * Sets a new volume for the clip. Effective only if an initial volume was specified (even if it was 1.0)
     * @param {Number} volume
     */
    SoundClip.prototype.setVolume = function (volume) {
        this._volume = volume;
        if (this._gainNode) {
            this._gainNode.gain.value = volume;
        }
    };
    /**
     * Increases the volume of the clip. Effective only if an initial volume was specified (even if it was 1.0)
     * @param {Number} amount
     */
    SoundClip.prototype.increaseVolume = function (amount) {
        this._volume += amount;
        if (this._gainNode) {
            this._gainNode.gain.value = this._volume;
        }
    };
    /**
     * Changes the volume of the clip via a linear or exponential ramp
     * @param {Number} volume The target value to change to
     * @param {Number} [duration=DEFAULT_RAMP_DURATION] The duration of the ramp, in seconds
     * @param {Boolean} [onlyIfDifferent=false] If true, then the ramp will not be applied in case a ramp is already in progress towards the
     * same value.
     * @param {Boolean} [exponential=false] If true, an exponential instead of linear ramp will be used, and the duration will be interpreted
     * as decay time instead
     */
    SoundClip.prototype.rampVolume = function (volume, duration, onlyIfDifferent, exponential) {
        var currentTime;
        if (this._gainNode && (!onlyIfDifferent || (this._volume !== volume))) {
            currentTime = _context.currentTime;
            this._gainNode.gain.cancelScheduledValues(currentTime);
            this._gainNode.gain.setValueAtTime(this._gainNode.gain.value, currentTime);
            if (exponential) {
                this._gainNode.gain.setTargetAtTime(volume, currentTime, duration || DEFAULT_RAMP_DURATION);
            } else {
                this._gainNode.gain.linearRampToValueAtTime(volume, currentTime + (duration || DEFAULT_RAMP_DURATION));
            }
        }
        this._volume = volume;
    };
    /**
     * Returns the current position (offset) of playback (where we are within the sample, starting from the beginning, in seconds)
     * @returns {Number}
     */
    SoundClip.prototype.getPlaybackPosition = function () {
        var time = _context.currentTime - this._playbackStartTime;
        return this._loop ? (time % _buffers[this._sampleName].duration) : Math.min(time, _buffers[this._sampleName].duration);
    };
    /**
     * Returns whether the sound sample is currently being played.
     * @returns {Boolean}
     */
    SoundClip.prototype.isPlaying = function () {
        return this._playing;
    };
    /**
     * Recreates the audio nodes, starting the playback of the clip over
     * @param {Number} offset From where to begin playback within the clip, in seconds
     * @param {Function} onFinish The function to call when the playback finishes / stops
     */
    SoundClip.prototype._startPlayingSample = function (offset, onFinish) {
        var currentNode;
        this._sourceNode = _context.createBufferSource();
        this._sourceNode.buffer = _buffers[this._sampleName];
        this._sourceNode.onended = function () {
            this._playing = false;
            if (onFinish) {
                onFinish();
            }
        }.bind(this);
        this._onFinish = onFinish;
        currentNode = this._sourceNode;
        if (this._volume !== undefined) {
            this._gainNode = _context.createGain();
            this._gainNode.gain.value = this._volume;
            currentNode.connect(this._gainNode);
            currentNode = this._gainNode;
        }
        if (this._loop) {
            this._sourceNode.loop = true;
        }
        if (this._soundSource) {
            currentNode.connect(this._soundSource.getNode());
        } else {
            switch (this._soundCategory) {
                case SoundCategory.SOUND_EFFECT:
                    currentNode.connect(_effectGain);
                    break;
                case SoundCategory.MUSIC:
                    currentNode.connect(_musicGain);
                    break;
                case SoundCategory.UI:
                    currentNode.connect(_uiGain);
                    break;
                default:
                    application.showError("Cannot play sound '" + this._sampleName + "', because it has an unkown category: " + this._soundCategory);
            }
        }
        this._playing = true;
        this._sourceNode.start(_context.currentTime, offset);
        this._playbackStartTime = _context.currentTime - offset;
    };
    /**
     * Starts a new playback of the sound clip. If a previous, non looping playback is in progress, the reference to it will be
     * dropped and the parameters of this class will control the new playback. If a looping playback is in progress, this method does 
     * nothing.
     * @param {Boolean} [restart=false] If true, the previous (last) playback from this sound will be stopped in case it is still playing
     * @param {Function} [onFinish] If given, this function will be executed when the sample finished its playback (for looping sounds, this
     * means when stop is called)
     */
    SoundClip.prototype.play = function (restart, onFinish) {
        var /** @type SoundClip */  clipToStackTo;
        if (_buffers[this._sampleName]) {
            if (this._playing) {
                if (restart) {
                    this.stopPlaying();
                } else if (this._loop) {
                    return;
                }
            }
            // stacking if we should
            if (this._soundSource && this._shouldStack) {
                clipToStackTo = this._soundSource.getClip(this._sampleName);
                if (clipToStackTo && clipToStackTo.isPlaying() && (clipToStackTo.getPlaybackPosition() <= this._stackTimeThreshold)) {
                    clipToStackTo.increaseVolume(this._volume * this._stackVolumeFactor);
                } else {
                    // start a new stack
                    this._startPlayingSample(0, onFinish);
                    if (this._soundSource) {
                        this._soundSource.setClip(this._sampleName, this);
                    }
                }
            } else {
                // simply start playing if stacking is disabled
                this._startPlayingSample(0, onFinish);
            }
        } else if (this._sampleName) {
            application.showError("Attempting to play back '" + this._sampleName + "', which is not loaded!");
        }
    };
    /**
     * Stops the playback of the sound (useful mostly for looping sounds)
     */
    SoundClip.prototype.stopPlaying = function () {
        if (this._sourceNode) {
            this._sourceNode.stop();
        }
    };
    /**
     * Stops the playback of the sound and removes references to the audio nodes
     */
    SoundClip.prototype.destroy = function () {
        this.stopPlaying();
        this._sourceNode = null;
        this._gainNode = null;
        this._position = null;
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
        SoundClip.call(_clip, SoundCategory.SOUND_EFFECT, sampleName, volume, false);
        if (position) {
            SoundSource.call(_source, position, rolloffFactor, DEFAULT_PANNING_MODEL);
            _clip.setSource(_source);
        }
        _clip.play();
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
     * Sets a master volume applied to UI sounds.
     * @param {Number} value
     */
    function setUIVolume(value) {
        _uiGain.gain.value = value;
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
    _uiGain = _context.createGain();
    _uiGain.connect(_masterGain);
    _clip = new SoundClip();
    _source = new SoundSource();
    // -------------------------------------------------------------------------
    // Public interface
    return {
        SoundCategory: SoundCategory,
        PanningModel: PanningModel,
        SoundClip: SoundClip,
        SoundSource: SoundSource,
        loadSample: loadSample,
        playSound: playSound,
        setEffectVolume: setEffectVolume,
        setMusicVolume: setMusicVolume,
        setUIVolume: setUIVolume,
        setMasterVolume: setMasterVolume
    };
});

