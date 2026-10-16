const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const virtualViewStub = path.resolve(
  projectRoot,
  "metro-stubs/VirtualViewNativeComponent.js",
);

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// Prefer RN entry (Fabric/codegen) over CJS main — required for react-native-screens on SDK 57.
config.resolver.resolverMainFields = ["react-native", "browser", "main"];
config.resolver.unstable_enablePackageExports = true;

const coreRoot = path.resolve(workspaceRoot, "packages/core/src");

const upstreamResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === "./VirtualViewNativeComponent" ||
    moduleName.endsWith("/VirtualViewNativeComponent")
  ) {
    return { filePath: virtualViewStub, type: "sourceFile" };
  }
  // Resolve workspace @shapeshift/core to TypeScript sources (package exports + ESM).
  if (moduleName === "@shapeshift/core") {
    return {
      filePath: path.join(coreRoot, "index.ts"),
      type: "sourceFile",
    };
  }
  if (moduleName.startsWith("@shapeshift/core/")) {
    const sub = moduleName.slice("@shapeshift/core/".length);
    const candidates = [
      path.join(coreRoot, `${sub}.ts`),
      path.join(coreRoot, sub, "index.ts"),
    ];
    for (const filePath of candidates) {
      try {
        require("fs").accessSync(filePath);
        return { filePath, type: "sourceFile" };
      } catch {
        /* try next */
      }
    }
  }
  if (typeof upstreamResolve === "function") {
    return upstreamResolve(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
