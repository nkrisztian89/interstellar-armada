#version 100

precision mediump float;

// common uniforms
uniform vec3 u_color;

varying vec3 v_position;
varying float v_dist;
varying float v_ratio;
	
void main() {
    gl_FragColor = vec4(
        u_color.rgb,
        (min(1.0, - 4.0 * v_dist + 4.0) * (1.0 - v_position.x)) * v_ratio);
}
