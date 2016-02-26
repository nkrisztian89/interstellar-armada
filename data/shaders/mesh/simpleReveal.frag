// same as simple.frag, but adding reveal functionality

precision mediump float;

struct Light
    {
        vec3 color;
        vec3 direction;
    };
	
uniform sampler2D u_diffuseTexture;
uniform sampler2D u_specularTexture;
uniform vec3 u_eyePos;
uniform Light u_lights[12];
uniform int u_numLights;

// the Y coordinate in model space from where the fragments are revealed
uniform float u_revealStart;
// whether the front part (larger Y coordinates) of model is the one revealed
uniform bool u_revealFront;
// a gradient transition from u_revealColor will be added for this length after u_revealStart
uniform float u_revealTransitionLength;
uniform vec4 u_revealColor;

varying vec2 v_texCoord;
varying vec3 v_normal;
varying vec4 v_color;
varying float v_luminosity;
varying float v_shininess;

// the coordinates of this fragment in world space
varying vec4 v_worldPos;
// the coordinates of this fragment in model space
varying vec4 v_modelPos;
	
void main() {
    // discard fragments that are not revealed yet
    if ((u_revealFront==true) && (v_modelPos.y<=u_revealStart)) {
        discard;
    } else
    if ((u_revealFront==false) && (v_modelPos.y>=u_revealStart)) {
        discard;
    // calculate the color of the revealed fragments
    } else {
        // interpolated normals can have different then unit length
        vec3 normal = normalize(v_normal);

        vec3 viewDir = normalize(v_worldPos.xyz - u_eyePos);
        vec3 reflDir = reflect (viewDir, normal);

        vec4 texCol = texture2D(u_diffuseTexture, v_texCoord);
        vec4 texSpec = texture2D(u_specularTexture, v_texCoord);

        vec4 color;
        color.rgb = v_luminosity * v_color.rgb * texCol.rgb;

        float specularFactor;

        for(int i=0;i<12;i++) {
            if(i<u_numLights) {
                specularFactor = v_shininess>0.0?pow(max(dot(reflDir,u_lights[i].direction),0.0), v_shininess):0.0;

                color.rgb += 
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
        color.a = v_color.a*texCol.a; 

        // add a u_revealTransitionLength long transition from white to the calculated color from the start of reveal
        if ((u_revealFront==true) && (v_modelPos.y<=u_revealStart+u_revealTransitionLength)) {
            float factor = (v_modelPos.y-u_revealStart)/u_revealTransitionLength;
            color = color * factor + u_revealColor * (1.0-factor);
        } else
        if ((u_revealFront==false) && (v_modelPos.y>=u_revealStart-u_revealTransitionLength)) {
            float factor = (u_revealStart-v_modelPos.y)/u_revealTransitionLength;
            color = color * factor + u_revealColor * (1.0-factor);
        }

        gl_FragColor = color;
    }
}