/*jslint white: true*/
/*global module*/
module.exports = function (grunt) {
    "use strict";
    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        requirejs: {
            compile: {
                options: {
                    baseUrl: "js",
                    name: "main",
                    optimize: "uglify2",
                    out: "js/main-optimized.js",
                    preserveLicenseComments: false
                }
            }
        },
        rawClean: {
            dev: ["js/main-optimized.js"]
        },
        eslint: {
            options: {
                configFile: ".eslintrc.js"
            },
            target: ["js/"]
        },
        replace: {
            dist: {
                src: ['index.html'],
                dest: "./",
                replacements: [{
                        from: 'main.js',
                        to: 'main-optimized.js'
                    }]
            },
            preOptimize: {
                src: ['js/utils/matrices.js'],
                dest: 'js/utils/',
                replacements: [{
                        from: '_matrixCount++;',
                        to: '//_matrixCount++;'
                    }, {
                        from: 'application.log_DEBUG',
                        to: '//application.log_DEBUG'
                    }]
            },
            // replacing some widely and frequently used one-line getter calls with the direct access of their respective properties to
            // avoid the overhead of calling the getter functions
            optimize: {
                src: ['js/main-optimized.js'],
                dest: 'js/',
                replacements: [{
                        from: '.getPositionMatrix()',
                        to: '._positionMatrix'
                    }, {
                        from: '.getOrientationMatrix()',
                        to: '._orientationMatrix'
                    }, {
                        from: '.getScalingMatrix()',
                        to: '._scalingMatrix'
                    }, {
                        from: '.getParent()',
                        to: '._parent'
                    }, {
                        from: '.getScene()',
                        to: '._scene'
                    }, {
                        from: '.getRenderableObject()',
                        to: '._renderableObject'
                    }, {
                        from: '.getSubnodes()',
                        to: '._subnodes'
                    }, {
                        from: '.wasRendered()',
                        to: '._wasRendered'
                    }, {
                        from: '.getStates()',
                        to: '._states'
                    }, {
                        from: '.getDuration()',
                        to: '._duration'
                    }, {
                        from: '.getVisualModel()',
                        to: '._visualModel'
                    }, {
                        from: '.getPhysicalModel()',
                        to: '._physicalModel'
                    }, {
                        from: '.childrenAlwaysInside()',
                        to: '._childrenAlwaysInside'
                    }, {
                        from: '.shouldIgnoreTransform()',
                        to: '._ignoreTransform'
                    }, {
                        from: 'setFileCacheBypassEnabled(!0)',
                        to: 'setFileCacheBypassEnabled(0)'
                    }]
            },
            postOptimize: {
                src: ['js/utils/matrices.js'],
                dest: 'js/utils/',
                replacements: [{
                        from: '//_matrixCount++;',
                        to: '_matrixCount++;'
                    }, {
                        from: '//application.log_DEBUG',
                        to: 'application.log_DEBUG'
                    }]
            },
            dev: {
                src: ['index.html'],
                dest: "./",
                replacements: [{
                        from: 'main-optimized.js',
                        to: 'main.js'
                    }]
            }
        }
    });
    // Plugins
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-requirejs');
    grunt.loadNpmTasks('grunt-text-replace');
    grunt.loadNpmTasks('grunt-eslint');
    // Tasks
    grunt.registerTask('default', ['build']);
    grunt.registerTask('build', ['replace:preOptimize', 'requirejs', 'replace:dist', 'replace:optimize', 'replace:postOptimize']);
    grunt.renameTask('clean', 'rawClean');
    grunt.registerTask('clean', ['rawClean:dev', 'replace:dev']);
    grunt.registerTask('lint', ['eslint']);
};