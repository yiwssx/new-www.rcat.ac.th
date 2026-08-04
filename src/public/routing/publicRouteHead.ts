import type {
  PublicRouteHeadContextData,
  PublicRouteHeadInput,
  PublicStructuredDataEntry,
  StaticPublicRouteHead
} from "./publicRouteHeadImpl";

export type {
  PublicRouteHeadContextData,
  PublicRouteHeadInput,
  PublicStructuredDataEntry,
  StaticPublicRouteHead
} from "./publicRouteHeadImpl";

function loadPublicRouteHeadImplementation() {
  return import("./publicRouteHeadImpl");
}

export async function buildPublicRouteHead(input: PublicRouteHeadInput) {
  const implementation = await loadPublicRouteHeadImplementation();
  return implementation.buildPublicRouteHead(input);
}

export async function getRootRouteHead() {
  const implementation = await loadPublicRouteHeadImplementation();
  return implementation.getRootRouteHead();
}

export async function getPublicLayoutRouteHead(loaderData?: unknown) {
  const implementation = await loadPublicRouteHeadImplementation();
  return implementation.getPublicLayoutRouteHead(loaderData);
}

export async function getStaticPublicRouteHead(
  pathname: string,
  search?: Record<string, unknown>,
  context?: PublicRouteHeadContextData
) {
  const implementation = await loadPublicRouteHeadImplementation();
  return implementation.getStaticPublicRouteHead(pathname, search, context);
}

export async function getPublicContentRouteHead(
  slug: string,
  loaderData?: unknown,
  context?: PublicRouteHeadContextData
) {
  const implementation = await loadPublicRouteHeadImplementation();
  return implementation.getPublicContentRouteHead(slug, loaderData, context);
}

export async function getCmsRouteHead() {
  const implementation = await loadPublicRouteHeadImplementation();
  return implementation.getCmsRouteHead();
}
