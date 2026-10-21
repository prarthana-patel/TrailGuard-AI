import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const alias={'@':root};
await build({configFile:false,root:resolve(root,'render'),publicDir:resolve(root,'public'),plugins:[react()],resolve:{alias},build:{outDir:resolve(root,'render-dist/client'),emptyOutDir:true,target:'es2022'}});
await build({configFile:false,root,publicDir:false,resolve:{alias:{...alias,'cloudflare:workers':resolve(root,'render/runtime.ts')}},ssr:{noExternal:['zod']},build:{ssr:resolve(root,'render/api-entry.ts'),outDir:resolve(root,'render-dist/server'),emptyOutDir:true,target:'node24',rollupOptions:{output:{entryFileNames:'api.mjs'}}}});
console.log('Render client and Node API built successfully.');
