export const PRODUCTION_SITE_URL = new URL("https://ers.wankysoftware.com");

type DeploymentEnvironment = {
  VERCEL_ENV?: string;
  VERCEL_URL?: string;
};

function getEnvironment(environment?: DeploymentEnvironment) {
  return environment ?? process.env;
}

export function isProductionDeployment(environment?: DeploymentEnvironment) {
  return getEnvironment(environment).VERCEL_ENV === "production";
}

export function getSiteUrl(environment?: DeploymentEnvironment) {
  const deployment = getEnvironment(environment);
  if (deployment.VERCEL_ENV === "production") {
    return new URL(PRODUCTION_SITE_URL);
  }

  const deploymentHost = deployment.VERCEL_URL?.trim();
  if (deploymentHost && /^[a-z\d](?:[a-z\d.-]*[a-z\d])?$/i.test(deploymentHost)) {
    return new URL(`https://${deploymentHost}`);
  }

  return new URL("http://localhost:3000");
}
