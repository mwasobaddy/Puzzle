export const puzzlePieceShader = {
  vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      uniform vec2 uvOffset;
      uniform vec2 uvScale;
      
      void main() {
        vUv = uvOffset + uv * uvScale;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D map;
      uniform float selected;
      uniform float correctPosition;
      uniform float time;
      
      varying vec2 vUv;
      varying vec3 vNormal;
      
      void main() {
        vec4 texColor = texture2D(map, vUv);
        vec3 normal = normalize(vNormal);
        vec3 lightDir = normalize(vec3(5.0, 5.0, 5.0));
        float diff = max(dot(normal, lightDir), 0.0);
        
        vec3 highlightColor = vec3(0.3, 0.6, 1.0);
        float highlightStrength = selected * 0.5 * (0.5 + 0.5 * sin(time * 3.0));
        
        vec3 correctColor = vec3(0.2, 1.0, 0.3);
        float correctStrength = correctPosition * 0.5 * (0.5 + 0.5 * sin(time * 2.0));
        
        vec3 finalColor = texColor.rgb * (vec3(0.3) + vec3(0.7) * diff);
        finalColor += highlightColor * highlightStrength + correctColor * correctStrength;
        
        gl_FragColor = vec4(finalColor, texColor.a);
      }
    `
};

export const outlineShader = {
  vertexShader: `
      varying vec2 vUv;
      
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform vec3 color;
      uniform float opacity;
      uniform float time;
      
      varying vec2 vUv;
      
      void main() {
        float pulse = 0.5 + 0.5 * sin(time * 2.0);
        vec3 finalColor = color;
        float finalOpacity = opacity * (0.8 + 0.2 * pulse);
        
        gl_FragColor = vec4(finalColor, finalOpacity);
      }
    `
};