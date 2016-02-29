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
        replace: {
            dist: {
                src: ['index.html'],
                dest: "./",
                replacements: [{
                        from: 'main.js',
                        to: 'main-optimized.js'
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
    // Tasks
    grunt.registerTask('default', ['build']);
    grunt.registerTask('build', ['requirejs', 'replace:dist']);
    grunt.renameTask('clean', 'rawClean');
    grunt.registerTask('clean', ['rawClean:dev', 'replace:dev']);
};