import { fetchInstance } from "./fetchInstance";

export const getAdvanceTransaction = async (
  sender: string,
  recipient: string,
  amount: string
) => {
  return fetchInstance<{ id: string; transaction: string }>("/nonces", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender,
      recipient,
      amount,
    }),
  });
};

export const confirmAdvanceTransaction = async (
  id: string,
  signature: string
) => {
  return fetchInstance<string>(`/nonces/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ signature }),
  });
};
