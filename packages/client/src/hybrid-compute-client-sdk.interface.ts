import {ParamType} from "ethers";

/**
 * Interface for creating an invoke transaction
 */
export interface CreateInvokeTransaction {
    transaction: {
        contractAddress: string;
        parameters: {
            types: ReadonlyArray<string | ParamType>;
            values: ReadonlyArray<any>;
        };
        value: string;
    };
    selector: {
        name: string;
        params?: Array<any>;
    };
}

/**
 * Interface for an invoke transaction
 */
export interface InvokeTransaction {
    payload: {
        to: string;
        value: string;
        data: any;
    };
    scope: string;
}

/**
 * Interface for invoke transaction options
 */
export interface InvokeTransactionOptions {
    transactionDetails: InvokeTransaction;
    usePaymaster?: boolean;
}

export type GetSnapsResponse = Record<string, Snap>;

export type Snap = {
    permissionName: string;
    id: string;
    version: string;
    initialPermissions: Record<string, unknown>;
};
