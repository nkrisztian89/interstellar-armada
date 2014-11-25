// Lambert shading with one light source.

precision mediump float;

struct Light
    {
        vec3 color;
        vec3 direction;
    };

uniform sampler2D u_colorTexture;
uniform Light u_lights[1];
	
varying vec2 v_texCoord;
varying vec3 v_normal;
varying vec4 v_color;
varying float v_luminosity;

void main() {
    vec4 texCol = texture2D(u_colorTexture, v_texCoord);
    // interpolated normals can have different then unit length
    vec3 normal = normalize(v_normal);
    gl_FragColor.rgb = v_luminosity * v_color.rgb * texCol.rgb;
    gl_FragColor.rgb += v_color.rgb * texCol.rgb * u_lights[0].color * max(0.0, dot(+u_lights[0].direction, normal));
    gl_FragColor.a = v_color.a * texCol.a;
}