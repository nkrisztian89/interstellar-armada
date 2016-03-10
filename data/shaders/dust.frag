#define DUST_LENGTH_DIVISOR 200.0

precision mediump float;

// common uniforms
uniform vec3 u_color;
uniform float u_length;

varying vec3 v_position;
varying float v_dist;
	
void main() {
    gl_FragColor = vec4(
        u_color.rgb,
        ((1.0 - v_dist) * (1.0 - v_position.x)) / max(1.0, u_length / DUST_LENGTH_DIVISOR));
}
