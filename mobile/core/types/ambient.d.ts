declare module "mixpanel-react-native" {
  export class Mixpanel {
    constructor(token: string, trackAutomaticEvents?: boolean);
    init(): Promise<void>;
    track(eventName: string, props?: Record<string, unknown>): void;
    identify(userId: string): void;
    getPeople?(): { set(props: Record<string, unknown>): void };
  }
}

declare module "@sentry/react-native" {
  export const ReactNativeTracing: any;
  export function init(options?: any): void;
  export function reactNavigationIntegration(...args: any[]): any;
  export function setUser(user: any): void;
  export function setTags(tags: Record<string, any>): void;
  export function startTransaction(options?: any): any;
  export function startSpan(options?: any, callback?: any): any;
  export function captureException(error: any, context?: any): void;
  export function captureMessage(message: string, context?: any): void;
  export function addBreadcrumb(breadcrumb: any): void;
  export function showReportDialog(options?: any): void;
  export function withProfiler(component: any, options?: any): any;
}

declare module "@react-native-community/netinfo" {
  export type NetInfoState = {
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
    type: string;
  };
  const NetInfo: {
    fetch(): Promise<NetInfoState>;
    addEventListener(listener: (state: NetInfoState) => void): () => void;
  };
  export default NetInfo;
}
