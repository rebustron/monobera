"use client";

import {
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactElement,
} from "react";
import {
  useAddRecentTransaction,
  useBeraContractWrite,
  useValueSend,
  type IContractWrite,
  type IValueSend,
  TransactionActionType,
} from "@bera/berajs";
import toast from "react-hot-toast";
import { useMediaQuery } from "usehooks-ts";
import { Abi, ContractFunctionName } from "viem";

import { ErrorToast, LoadingToast, SubmissionToast, SuccessToast } from "../";
import {
  ErrorModal,
  LoadingModal,
  SubmissionModal,
  SuccessModal,
} from "../txn-modals";
import { useAnalytics } from "../utils/analytics";
import {
  CLOSE_MODAL,
  OPEN_MODAL,
  initialState,
  modalReducer,
  type ModalName,
} from "../utils/modalsReducer";

interface IUseTxn {
  message?: string;
  actionType?: TransactionActionType;
  disableToast?: boolean;
  disableModal?: boolean;
  CustomSuccessModal?: React.FC;
  customSuccessModalProps?: any;
  onSuccess?: (hash: string) => void;
  onError?: (e?: Error) => void;
  onLoading?: () => void;
  onSubmission?: (hash: string) => void;
}

interface UseTxnApi {
  write<
    TAbi extends Abi | any[] = Abi,
    TFunctionName extends
      ContractFunctionName<TAbi> = ContractFunctionName<TAbi>,
  >(props: IContractWrite<TAbi, TFunctionName>): void;
  fundWrite: (props: IValueSend) => void;
  isLoading: boolean;
  isSubmitting: boolean;
  isSuccess: boolean;
  isError: boolean;
  isFundingLoading: boolean;
  isFundingSubmitting: boolean;
  isFundingSuccess: boolean;
  isFundingError: boolean;
  ModalPortal: ReactElement<any, any>;
}

const DURATION = 3000;

/**
 * @typedef {Object} IUseTxn
 * @property {string} [message] - The message to be displayed in the toast and transaction history.
 */

/**
 * @typedef {Object} UseTxnApi
 * @property {Function} write - Function to initiate a contract write operation.
 * @property {boolean} isLoading - Indicates if the transaction is currently loading.
 * @property {boolean} isSuccess - Indicates if the transaction was successful.
 * @property {boolean} isError - Indicates if the transaction encountered an error.
 */

/**
 * Custom React hook for handling transactions with toasts and transaction history.
 *
 * @param {IUseTxn} options - Options for the hook.
 * @returns {UseTxnApi} - An object containing transaction-related properties and functions.
 */
export const useTxn = ({
  message = "",
  actionType,
  disableToast = false,
  disableModal = false,
  CustomSuccessModal,
  customSuccessModalProps,
  onSuccess,
  onError,
  onLoading,
  onSubmission,
}: IUseTxn = {}): UseTxnApi => {
  const [identifier, setIdentifier] = useState("");
  const isMd = useMediaQuery("(min-width: 768px)");

  const [modalState, dispatch] = useReducer(modalReducer, initialState);
  const openModal = (modalName: ModalName, modalData: any) => {
    dispatch({ type: OPEN_MODAL, modalName, modalData });
  };

  const closeModal = (modalName: ModalName) => {
    dispatch({ type: CLOSE_MODAL, modalName });
  };
  /**
   * Generate a unique identifier for the transaction based on the message.
   */
  useEffect(() => {
    setIdentifier(message + Math.random().toString(6));
  }, [message]);

  const addRecentTransaction = useAddRecentTransaction();

  const { captureException, track } = useAnalytics();

  const { write, isLoading, isSubmitting, isSuccess, isError } =
    useBeraContractWrite({
      /**
       * Error callback function executed when a transaction encounters an error.
       *
       * @param {Error} error - The error object.
       */
      onError: (error: any) => {
        if (!disableToast) {
          const toastId = `error-${identifier}`;
          toast.remove(`loading-${identifier}`);
          toast.remove(`submission-${identifier}`);
          if (error?.message.includes("User rejected the request.")) {
            toast.custom(
              <ErrorToast
                title={"User rejected txn"}
                onClose={() => toast.remove(toastId)}
              />,
              {
                duration: DURATION,
                id: toastId,
                position: isMd ? "bottom-right" : "top-center",
              },
            );
          } else {
            toast.custom(
              <ErrorToast
                title={"Transaction failed"}
                message={error?.message || "unknown error"}
                onClose={() => toast.remove(toastId)}
                hash={error?.hash}
              />,
              {
                duration: DURATION,
                id: toastId,
                position: isMd ? "bottom-right" : "top-center",
              },
            );
          }
        }
        if (!disableModal) {
          closeModal("loadingModal");
          closeModal("submissionModal");
          if (error?.message.includes("User rejected the request.")) {
            openModal("errorModal", {
              errorHash: error?.hash ?? "0x",
              errorMessage: "User rejected transaction",
            });
          } else {
            openModal("errorModal", {
              errorHash: error?.hash ?? "0x",
              errorMessage: error?.message || "unknown error",
            });
          }
        }
        track("transaction_failed", {
          operation: "useBeraContractWrite",
          message: error?.message,
          actionType,
        });
        if (
          !error?.message.includes("User rejected the request.") &&
          !error?.message.includes("You Rejected the transaction.") &&
          !error?.message.includes("insufficient funds")
        ) {
          // only capture the exception if the error is not related to user manual rejection or insufficient funds
          captureException(new Error(error?.message), {
            data: { message, actionType },
          });
        }
        onError?.(error);
      },

      /**
       * Success callback function executed when a transaction is successful.
       *
       * @param {string} result - The transaction hash or result.
       */
      onSuccess: (result: string) => {
        if (!disableToast) {
          const toastId = `success-${identifier}`;
          toast.remove(`submission-${identifier}`);
          toast.custom(
            <SuccessToast
              onClose={() => toast.remove(toastId)}
              title={"Transaction Success"}
              message="transaction successfully submitted"
              hash={result}
            />,
            {
              duration: DURATION,
              id: toastId,
              position: isMd ? "bottom-right" : "top-center",
            },
          );
        }
        if (!disableModal) {
          closeModal("loadingModal");
          closeModal("submissionModal");
          openModal("successModal", { successHash: result });
        }
        addRecentTransaction({
          hash: result,
          description: message,
          actionType,
          timestamp: Date.now(),
        });
        track("transaction_success", {
          message,
          actionType,
          hash: result,
          operation: "useBeraContractWrite",
        });
        onSuccess?.(result);
      },

      /**
       * Loading callback function executed when a transaction is loading or in progress.
       */
      onLoading: () => {
        if (!disableToast) {
          const toastId = `loading-${identifier}`;
          toast.custom(
            <LoadingToast
              title={"Waiting for wallet"}
              message="waiting for wallet action"
              onClose={() => toast.remove(toastId)}
            />,
            {
              id: toastId,
              duration: Infinity,
              position: isMd ? "bottom-right" : "top-center",
            },
          );
        }
        if (!disableModal) {
          openModal("loadingModal", undefined);
        }
        track("transaction_started", {
          message,
          actionType,
          operation: "useBeraContractWrite",
        });
        onLoading?.();
      },

      /**
       * Submission callback function executed when a transaction is submitted.
       */
      onSubmission: (result: string) => {
        if (!disableToast) {
          const toastId = `submission-${identifier}`;
          toast.remove(`loading-${identifier}`);
          toast.custom(
            <SubmissionToast
              title={"Transaction pending"}
              message="waiting for confirmation"
              onClose={() => toast.remove(toastId)}
              hash={result}
            />,
            {
              id: toastId,
              duration: Infinity,
              position: isMd ? "bottom-right" : "top-center",
            },
          );
        }
        if (!disableModal) {
          closeModal("loadingModal");
          openModal("submissionModal", {
            submissionHash: result,
          });
        }
        onSubmission?.(result);
      },
    });

  const {
    write: fundWrite,
    isLoading: isFundingLoading,
    isSubmitting: isFundingSubmitting,
    isSuccess: isFundingSuccess,
    isError: isFundingError,
  } = useValueSend({
    /**
     * Error callback function executed when a transaction encounters an error.
     *
     * @param {Error} error - The error object.
     */
    onError: (error: any) => {
      if (!disableToast) {
        const toastId = `error-${identifier}`;
        toast.remove(`loading-${identifier}`);
        toast.remove(`submission-${identifier}`);
        if (error?.message.includes("User rejected the request.")) {
          toast.custom(
            <ErrorToast
              title={"User rejected transaction"}
              onClose={() => toast.remove(toastId)}
            />,
            {
              duration: DURATION,
              id: toastId,
              position: isMd ? "bottom-right" : "top-center",
            },
          );
        } else {
          toast.custom(
            <ErrorToast
              title={"Transaction failed"}
              message={error?.message || "unknown error"}
              onClose={() => toast.remove(toastId)}
              hash={error?.hash}
            />,
            {
              duration: DURATION,
              id: toastId,
              position: isMd ? "bottom-right" : "top-center",
            },
          );
        }
      }
      if (!disableModal) {
        closeModal("loadingModal");
        closeModal("submissionModal");
        if (error?.message.includes("User rejected the request.")) {
          openModal("errorModal", {
            errorHash: "0x",
            errorMessage: "User rejected transaction",
          });
        } else {
          openModal("errorModal", {
            errorHash: "0x",
            errorMessage: error?.message || "unknown error",
          });
        }
      }
      track("transaction_failed", {
        message: error?.message,
        actionType,
        operation: "useValueSend",
      });
      if (
        !error?.message.includes("User rejected the request.") &&
        !error?.message.includes("You Rejected the transaction.") &&
        !error?.message.includes("insufficient funds")
      ) {
        // only capture the exception if the error is not related to user manual rejection or insufficient funds
        captureException(new Error(error?.message), {
          data: { message, actionType },
        });
      }
      onError?.(error);
    },

    /**
     * Success callback function executed when a transaction is successful.
     *
     * @param {string} result - The transaction hash or result.
     */
    onSuccess: (result: string) => {
      if (!disableToast) {
        const toastId = `success-${identifier}`;
        toast.remove(`submission-${identifier}`);
        toast.custom(
          <SuccessToast
            onClose={() => toast.remove(toastId)}
            title={"Transaction Success"}
            message="transaction successfully submitted"
            hash={result}
          />,
          {
            duration: DURATION,
            id: toastId,
            position: isMd ? "bottom-right" : "top-center",
          },
        );
      }
      if (!disableModal) {
        closeModal("loadingModal");
        closeModal("submissionModal");
        openModal("successModal", { successHash: result });
      }
      addRecentTransaction({
        hash: result,
        description: message,
        timestamp: Date.now(),
        actionType: TransactionActionType.BORROW,
      });
      track("transaction_success", {
        message,
        actionType,
        hash: result,
        operation: "useValueSend",
      });
      onSuccess?.(result);
    },

    /**
     * Loading callback function executed when a transaction is loading or in progress.
     */
    onLoading: () => {
      if (!disableToast) {
        const toastId = `loading-${identifier}`;
        toast.custom(
          <LoadingToast
            title={"Waiting for wallet"}
            message="waiting for wallet action"
            onClose={() => toast.remove(toastId)}
          />,
          {
            id: toastId,
            duration: Infinity,
            position: isMd ? "bottom-right" : "top-center",
          },
        );
      }
      if (!disableModal) {
        openModal("loadingModal", undefined);
      }
      track("transaction_started", {
        message,
        actionType,
        operation: "useValueSend",
      });
      onLoading?.();
    },

    /**
     * Submission callback function executed when a transaction is submitted.
     */
    onSubmission: (result: string) => {
      if (!disableToast) {
        const toastId = `submission-${identifier}`;
        toast.remove(`loading-${identifier}`);
        toast.custom(
          <SubmissionToast
            title={"Transaction submitted"}
            message="waiting for confirmation"
            onClose={() => toast.remove(toastId)}
            hash={result}
          />,
          {
            id: toastId,
            position: isMd ? "bottom-right" : "top-center",
          },
        );
      }
      if (!disableModal) {
        closeModal("loadingModal");
        openModal("submissionModal", {
          submissionHash: result,
        });
      }
      onSubmission?.(result);
    },
  });

  const ModalPortal = () => {
    return (
      <>
        <ErrorModal
          title="Error"
          onClose={() => closeModal("errorModal")}
          open={modalState.errorModal?.isOpen ?? false}
          message={modalState.errorModal?.errorMessage}
          hash={modalState.errorModal?.errorHash}
        />
        <LoadingModal
          title="Waiting for wallet"
          onClose={() => closeModal("loadingModal")}
          open={modalState.loadingModal?.isOpen ?? false}
          message={message}
          hash={undefined}
        />
        <SubmissionModal
          title="Transaction pending"
          onClose={() => closeModal("submissionModal")}
          open={modalState.submissionModal?.isOpen ?? false}
          message={message}
          hash={modalState.submissionModal?.submissionHash}
        />
        {!CustomSuccessModal ? (
          <SuccessModal
            title="Transaction Success"
            onClose={() => closeModal("successModal")}
            open={modalState.successModal?.isOpen ?? false}
            message={message}
            hash={modalState.successModal?.successHash}
          />
        ) : (
          <CustomSuccessModal
            {...customSuccessModalProps}
            onClose={() => closeModal("successModal")}
            open={modalState.successModal?.isOpen ?? false}
          />
        )}
      </>
    );
  };
  const memoizedModalPortal = useMemo(
    () => <ModalPortal />,
    [isLoading, isSubmitting, isSuccess, isError, modalState],
  );

  return {
    write,
    isLoading,
    isSubmitting,
    isSuccess,
    isError,
    fundWrite,
    isFundingLoading,
    isFundingSubmitting,
    isFundingSuccess,
    isFundingError,
    ModalPortal: memoizedModalPortal as ReactElement<any, any>,
  };
};
