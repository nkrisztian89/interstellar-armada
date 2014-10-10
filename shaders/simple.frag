// shader used in general for meshes

precision mediump float;

struct Light
    {
        vec3 color;
        vec3 direction;
    };
	
uniform sampler2D u_colorTexture;
uniform sampler2D u_specularTexture;
uniform vec3 u_eyePos;
uniform Light u_lights[12];
uniform int u_numLights;
	
varying vec2 v_texCoord;
varying vec3 v_normal;
varying vec4 v_color;
varying float v_luminosity;
varying float v_shininess;

varying vec4 v_worldPos;

void main() {
    // interpolated normals can have different then unit length
    vec3 normal = normalize(v_normal);

    vec3 viewDir = normalize(v_worldPos.xyz - u_eyePos);
    vec3 reflDir = reflect (viewDir, normal);

    vec4 texCol = texture2D(u_colorTexture, v_texCoord);
    vec4 texSpec = texture2D(u_specularTexture, v_texCoord);

    gl_FragColor.rgb = v_luminosity * v_color.rgb * texCol.rgb;

    float specularFactor;

    for(int i=0;i<12;i++) {
        if(i<u_numLights) {
            specularFactor = v_shininess>0.0?pow(max(dot(reflDir,u_lights[i].direction),0.0), v_shininess):0.0;

            gl_FragColor.rgb += 
                vec3(
                    // the RGB components
                        clamp(
                        // diffuse light reflected for different light sources
                        u_lights[i].color*max(0.0,dot(+u_lights[i].direction,normal))
                        // clamp each component
                        ,0.0,1.0)
                        // modulate with the colors from the vertices and the texture
                        // the above components cannot make the surface lighter then
                        // the modulated diffuse texture
                        * v_color.rgb * texCol.rgb
                        // add specular lighting, this can make the surface "overlighted"
                        + specularFactor * u_lights[i].color * texSpec.rgb
                );
        }
    }
    // the alpha component from the attribute color and texture
    gl_FragColor.a = v_color.a*texCol.a; 
}
