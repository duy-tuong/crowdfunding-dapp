"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { contractAddress, abi } from "../lib/contract";

export default function Home() {
  const createRef = useRef<HTMLDivElement | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const SEPOLIA_CHAIN_ID = BigInt(11155111);
  const [account, setAccount] = useState("");
  const [userNameInput, setUserNameInput] = useState("");
  const [currentUserName, setCurrentUserName] = useState("");
  const [isEditingUserName, setIsEditingUserName] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [campaignGoalEth, setCampaignGoalEth] = useState("0.1");
  const [campaignDurationDays, setCampaignDurationDays] = useState("7");
  const [campaigns, setCampaigns] = useState<
    {
      id: number;
      creator: string;
      name: string;
      goal: bigint;
      pledged: bigint;
      deadline: bigint;
      claimed: boolean;
      contributed: boolean;
    }[]
  >([]);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);
  const [pledgeAmounts, setPledgeAmounts] = useState<Record<number, string>>(
    {},
  );
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(
    null,
  );
  const [selectedCampaign, setSelectedCampaign] = useState<{
    id: number;
    creator: string;
    name: string;
    goal: bigint;
    pledged: bigint;
    deadline: bigint;
    claimed: boolean;
  } | null>(null);
  const [pledgeHistory, setPledgeHistory] = useState<
    {
      contributor: string;
      amount: bigint;
      totalPledged: bigint;
      blockNumber: number;
      txHash: string;
    }[]
  >([]);
  const [claimHistory, setClaimHistory] = useState<
    {
      creator: string;
      amount: bigint;
      blockNumber: number;
      txHash: string;
    }[]
  >([]);
  const [refundHistory, setRefundHistory] = useState<
    {
      contributor: string;
      amount: bigint;
      blockNumber: number;
      txHash: string;
    }[]
  >([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState("contributors");
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;
  const [toast, setToast] = useState<{
    type: "info" | "success" | "error";
    message: string;
  } | null>(null);
  const [txStatus, setTxStatus] = useState<
    "idle" | "pending" | "success" | "error"
  >("idle");
  const [networkWarning, setNetworkWarning] = useState<string | null>(null);
  const [txHistory, setTxHistory] = useState<
    {
      hash: string;
      status: "pending" | "success" | "error";
      label: string;
    }[]
  >([]);
  const [openCampaignCount, setOpenCampaignCount] = useState(0);
  const [refundedCampaignIds, setRefundedCampaignIds] = useState<number[]>([]);
  const [userNamesByAddress, setUserNamesByAddress] = useState<
    Record<string, string>
  >({});
  const explorerBase = "https://sepolia.etherscan.io/tx/";
  const explorerAddressBase = "https://sepolia.etherscan.io/address/";

  const showToast = useCallback(
    (type: "info" | "success" | "error", message: string) => {
      setToast({ type, message });
    },
    [],
  );

  const getProvider = useCallback(
    async (requireAccount: boolean) => {
      const ethereum = window.ethereum;
      if (!ethereum) {
        showToast("error", "Vui lòng cài đặt MetaMask để bắt đầu.");
        return null;
      }

      const provider = new ethers.BrowserProvider(ethereum);
      const network = await provider.getNetwork();
      if (network.chainId !== SEPOLIA_CHAIN_ID) {
        const chainId = Number(network.chainId).toString();
        setNetworkWarning(
          `Sai network. Hãy chọn Sepolia (chainId ${chainId}).`,
        );
        showToast(
          "error",
          "Network hiện tại không đúng. Vui lòng chuyển sang Sepolia.",
        );
        return null;
      }

      setNetworkWarning(null);
      if (requireAccount) {
        const accounts = await provider.send("eth_requestAccounts", []);
        setAccount(accounts[0] ?? "");
      }

      return { provider, ethereum };
    },
    [SEPOLIA_CHAIN_ID, showToast],
  );

  function trackTx(hash: string, label: string) {
    setTxHistory((prev) => [
      { hash, status: "pending", label },
      ...prev.slice(0, 4),
    ]);
  }

  function updateTx(hash: string, status: "success" | "error") {
    setTxHistory((prev) =>
      prev.map((item) => (item.hash === hash ? { ...item, status } : item)),
    );
  }

  function formatAddress(address: string, head = 6, tail = 4) {
    if (!address) {
      return "";
    }
    if (address.length <= head + tail + 3) {
      return address;
    }
    return `${address.slice(0, head)}...${address.slice(-tail)}`;
  }

  function getAddressKey(address: string) {
    return address.toLowerCase();
  }

  function displayName(address: string) {
    const name = userNamesByAddress[getAddressKey(address)];
    if (name && name.trim()) {
      return name;
    }
    return formatAddress(address);
  }

  function normalizeEthInput(value: string, maxDecimals: number) {
    if (value === "") {
      return value;
    }
    if (!/^\d*(\.\d*)?$/.test(value)) {
      return null;
    }
    const parts = value.split(".");
    if (parts.length === 2 && parts[1].length > maxDecimals) {
      return null;
    }
    return value;
  }

  function isValidEthAmount(value: string, maxDecimals: number) {
    if (!value) {
      return false;
    }
    if (!/^\d+(\.\d+)?$/.test(value)) {
      return false;
    }
    const parts = value.split(".");
    if (parts.length === 2 && parts[1].length > maxDecimals) {
      return false;
    }
    return Number(value) > 0;
  }

  function getErrorMessage(error: unknown) {
    if (error && typeof error === "object" && "message" in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === "string") {
        return message;
      }
    }
    return "";
  }

  async function copyToClipboard(text: string, label: string) {
    if (!navigator.clipboard) {
      showToast("error", "Trình duyệt không hỗ trợ copy.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast("success", `Đã copy ${label}.`);
    } catch {
      showToast("error", "Không thể copy. Thử lại.");
    }
  }

  const loadUserNames = useCallback(
    async (contract: ethers.Contract, addresses: string[]) => {
      const unique = Array.from(
        new Set(addresses.filter(Boolean).map((addr) => getAddressKey(addr))),
      );
      if (unique.length === 0) {
        return;
      }
      const results = await Promise.all(
        unique.map(async (addr) => {
          const name = await contract.userNames(addr);
          return { addr, name: typeof name === "string" ? name : "" };
        }),
      );
      setUserNamesByAddress((prev) => {
        const next = { ...prev };
        for (const item of results) {
          next[item.addr] = item.name;
        }
        return next;
      });
    },
    [],
  );

  // 🔗 connect ví
  async function connectWallet() {
    const wallet = await getProvider(true);
    if (!wallet) {
      return;
    }

    await loadCampaigns(wallet.ethereum);
  }

  const loadCampaigns = useCallback(
    async (ethereum?: typeof window.ethereum) => {
      const providerSource = ethereum ?? window.ethereum;
      if (!providerSource) {
        setCampaigns([]);
        return;
      }

      const networkProvider = await getProvider(false);
      if (!networkProvider) {
        return;
      }

      setIsLoadingCampaigns(true);
      try {
        const contract = new ethers.Contract(
          contractAddress,
          abi,
          networkProvider.provider,
        );
        const count = await contract.count();
        const total = Number(count);
        const items = [];

        for (let id = 1; id <= total; id += 1) {
          const campaign = await contract.campaigns(id);
          let contributed = false;
          if (account) {
            const amount = await contract.pledgedAmount(id, account);
            contributed = amount > BigInt(0);
          }
          items.push({
            id,
            creator: campaign.creator,
            name: campaign.name,
            goal: campaign.goal,
            pledged: campaign.pledged,
            deadline: campaign.deadline,
            claimed: campaign.claimed,
            contributed,
          });
        }

        setCampaigns(items);
        if (account) {
          const openCount = await contract.openCampaignCount(account);
          setOpenCampaignCount(Number(openCount));
          const storedName = await contract.userNames(account);
          setCurrentUserName(storedName ?? "");
          setUserNameInput(storedName ?? "");
          setIsEditingUserName(!storedName);
          await loadUserNames(contract, [
            account,
            ...items.map((item) => item.creator),
          ]);
          const refundedFilter = contract.filters.Refunded(null, account);
          const refundedLogs = await contract.queryFilter(
            refundedFilter,
            0,
            "latest",
          );
          const refundedIds = refundedLogs
            .map((log) => {
              const parsed = contract.interface.parseLog(log);
              if (!parsed) {
                return null;
              }
              const args = parsed.args as unknown as { id: bigint };
              return Number(args.id);
            })
            .filter((value): value is number => value !== null);
          setRefundedCampaignIds(Array.from(new Set(refundedIds)));
        } else {
          setOpenCampaignCount(0);
          setRefundedCampaignIds([]);
          setCurrentUserName("");
          setUserNameInput("");
          setUserNamesByAddress({});
          setIsEditingUserName(false);
        }
      } finally {
        setIsLoadingCampaigns(false);
      }
    },
    [account, getProvider, loadUserNames],
  );

  // 💰 góp vốn
  async function pledge() {
    const wallet = await getProvider(true);
    if (!wallet) {
      return;
    }

    const signer = await wallet.provider.getSigner();
    const contract = new ethers.Contract(contractAddress, abi, signer);

    try {
      setTxStatus("pending");
      showToast("info", "Giao dịch của bạn đang được gửi...");
      const tx = await contract.pledge(1, {
        value: ethers.parseEther("0.01"),
      });
      trackTx(tx.hash, "Góp vốn #1");
      await tx.wait();
      updateTx(tx.hash, "success");
      setTxStatus("success");
      showToast("success", "Bạn đã góp vốn thành công!");
    } catch (error) {
      const details = getErrorMessage(error);
      setTxStatus("error");
      showToast(
        "error",
        details
          ? `Góp vốn chưa thành công: ${details}`
          : "Góp vốn chưa thành công, vui lòng thử lại.",
      );
      return;
    }
  }

  async function pledgeToCampaign(id: number) {
    const amount = pledgeAmounts[id] ?? "";
    if (!isValidEthAmount(amount, 6)) {
      showToast(
        "error",
        "Vui lòng nhập số ETH hợp lệ (tối đa 6 số thập phân).",
      );
      return;
    }

    const wallet = await getProvider(true);
    if (!wallet) {
      return;
    }

    const signer = await wallet.provider.getSigner();
    const contract = new ethers.Contract(contractAddress, abi, signer);

    try {
      setTxStatus("pending");
      showToast("info", "Đang thực hiện giao dịch, vui lòng chờ...");
      const tx = await contract.pledge(id, {
        value: ethers.parseEther(amount),
      });
      trackTx(tx.hash, `Góp vốn #${id}`);
      await tx.wait();
      updateTx(tx.hash, "success");
      setTxStatus("success");
      showToast("success", "Bạn đã góp vốn thành công!");
    } catch (error) {
      const details = getErrorMessage(error);
      setTxStatus("error");
      showToast(
        "error",
        details
          ? `Góp vốn chưa thành công: ${details}`
          : "Góp vốn chưa thành công, vui lòng thử lại.",
      );
      return;
    }

    await loadCampaigns(wallet.ethereum);
    if (selectedCampaignId === id) {
      await loadCampaignDetail(id, wallet.ethereum);
    }
  }

  async function claimCampaign(id: number) {
    const wallet = await getProvider(true);
    if (!wallet) {
      return;
    }

    const signer = await wallet.provider.getSigner();
    const contract = new ethers.Contract(contractAddress, abi, signer);

    try {
      setTxStatus("pending");
      showToast("info", "Đang rút tiền...");
      const tx = await contract.claim(id);
      trackTx(tx.hash, `Rút tiền #${id}`);
      await tx.wait();
      updateTx(tx.hash, "success");
      setTxStatus("success");
      showToast("success", "Rút tiền thành công!");
    } catch (error) {
      const details = getErrorMessage(error);
      setTxStatus("error");
      showToast(
        "error",
        details
          ? `Rút tiền thất bại: ${details}`
          : "Rút tiền thất bại. Vui lòng thử lại.",
      );
      return;
    }

    await loadCampaigns(wallet.ethereum);
    if (selectedCampaignId === id) {
      await loadCampaignDetail(id, wallet.ethereum);
    }
  }

  async function refundCampaign(id: number) {
    const wallet = await getProvider(true);
    if (!wallet) {
      return;
    }

    const signer = await wallet.provider.getSigner();
    const contract = new ethers.Contract(contractAddress, abi, signer);

    try {
      setTxStatus("pending");
      showToast("info", "Đang hoàn tiền...");
      const tx = await contract.refund(id);
      trackTx(tx.hash, `Hoàn tiền #${id}`);
      await tx.wait();
      updateTx(tx.hash, "success");
      setTxStatus("success");
      showToast("success", "Hoàn tiền thành công!");
      setRefundedCampaignIds((prev) =>
        prev.includes(id) ? prev : [...prev, id],
      );
    } catch (error) {
      const details = getErrorMessage(error);
      setTxStatus("error");
      showToast(
        "error",
        details
          ? `Hoàn tiền thất bại: ${details}`
          : "Hoàn tiền thất bại. Vui lòng thử lại.",
      );
      return;
    }

    await loadCampaigns(wallet.ethereum);
    if (selectedCampaignId === id) {
      await loadCampaignDetail(id, wallet.ethereum);
    }
  }

  // 🧩 tạo campaign
  async function createCampaign() {
    if (account && openCampaignCount >= 5) {
      showToast(
        "error",
        "Bạn đã có 5 chiến dịch đang mở. Vui lòng kết thúc bớt trước khi tạo mới.",
      );
      return;
    }
    const trimmedName = campaignName.trim();
    if (!trimmedName || trimmedName.length > 32) {
      showToast("error", "Tên chiến dịch phải từ 1 đến 32 ký tự.");
      return;
    }

    if (!isValidEthAmount(campaignGoalEth, 6)) {
      showToast("error", "Mục tiêu phải hợp lệ (tối đa 6 số thập phân).");
      return;
    }

    if (!campaignDurationDays || Number(campaignDurationDays) <= 0) {
      showToast("error", "Thời gian phải lớn hơn 0 ngày!");
      return;
    }

    const wallet = await getProvider(true);
    if (!wallet) {
      return;
    }

    const signer = await wallet.provider.getSigner();
    const contract = new ethers.Contract(contractAddress, abi, signer);

    const durationSeconds = BigInt(
      Math.floor(Number(campaignDurationDays)) * 24 * 60 * 60,
    );

    try {
      setTxStatus("pending");
      showToast("info", "Đang tạo chiến dịch...");
      const tx = await contract.createCampaign(
        trimmedName,
        ethers.parseEther(campaignGoalEth),
        durationSeconds,
      );
      trackTx(tx.hash, "Tạo chiến dịch");
      await tx.wait();
      updateTx(tx.hash, "success");
      setTxStatus("success");
      showToast("success", "Tạo chiến dịch thành công!");
      setCampaignName("");
    } catch (error) {
      const details = getErrorMessage(error);
      setTxStatus("error");
      showToast(
        "error",
        details
          ? `Tạo chiến dịch thất bại: ${details}`
          : "Tạo chiến dịch thất bại. Thử lại.",
      );
      return;
    }

    await loadCampaigns(wallet.ethereum);
  }

  async function saveUserName() {
    const trimmedName = userNameInput.trim();
    if (!trimmedName || trimmedName.length > 32) {
      showToast("error", "Tên người dùng phải từ 1 đến 32 ký tự.");
      return;
    }

    const wallet = await getProvider(true);
    if (!wallet) {
      return;
    }

    const signer = await wallet.provider.getSigner();
    const contract = new ethers.Contract(contractAddress, abi, signer);

    try {
      setTxStatus("pending");
      showToast("info", "Đang lưu tên người dùng...");
      const tx = await contract.setUserName(trimmedName);
      trackTx(tx.hash, "Cập nhật tên");
      await tx.wait();
      updateTx(tx.hash, "success");
      setTxStatus("success");
      showToast("success", "Cập nhật tên thành công!");
      setCurrentUserName(trimmedName);
      setIsEditingUserName(false);
      if (account) {
        setUserNamesByAddress((prev) => ({
          ...prev,
          [getAddressKey(account)]: trimmedName,
        }));
      }
    } catch (error) {
      const details = getErrorMessage(error);
      setTxStatus("error");
      showToast(
        "error",
        details
          ? `Cập nhật tên thất bại: ${details}`
          : "Cập nhật tên thất bại. Thử lại.",
      );
    }
  }

  const loadCampaignDetail = useCallback(
    async (id: number, ethereum?: typeof window.ethereum) => {
      const providerSource = ethereum ?? window.ethereum;
      if (!providerSource) {
        return;
      }

      setIsLoadingDetail(true);
      try {
        const provider = new ethers.BrowserProvider(providerSource);
        const contract = new ethers.Contract(contractAddress, abi, provider);
        const campaign = await contract.campaigns(id);
        setSelectedCampaign({
          id,
          creator: campaign.creator,
          name: campaign.name,
          goal: campaign.goal,
          pledged: campaign.pledged,
          deadline: campaign.deadline,
          claimed: campaign.claimed,
        });

        const filter = contract.filters.Pledged(id);
        const logs = await contract.queryFilter(filter, 0, "latest");
        const mapped = logs.map((log) => {
          const parsed = contract.interface.parseLog(log);
          if (!parsed) {
            return null;
          }
          const args = parsed.args as unknown as {
            contributor: string;
            amount: bigint;
            totalPledged: bigint;
          };
          return {
            contributor: args.contributor,
            amount: args.amount,
            totalPledged: args.totalPledged,
            blockNumber: log.blockNumber,
            txHash: log.transactionHash,
          };
        });
        const history = mapped.filter(
          (item): item is NonNullable<typeof item> => item !== null,
        );
        setPledgeHistory(history.reverse());

        const claimFilter = contract.filters.Claimed(id);
        const claimLogs = await contract.queryFilter(claimFilter, 0, "latest");
        const claimMapped = claimLogs.map((log) => {
          const parsed = contract.interface.parseLog(log);
          if (!parsed) {
            return null;
          }
          const args = parsed.args as unknown as {
            creator: string;
            amount: bigint;
          };
          return {
            creator: args.creator,
            amount: args.amount,
            blockNumber: log.blockNumber,
            txHash: log.transactionHash,
          };
        });
        const claims = claimMapped.filter(
          (item): item is NonNullable<typeof item> => item !== null,
        );
        setClaimHistory(claims.reverse());

        const refundFilter = contract.filters.Refunded(id);
        const refundLogs = await contract.queryFilter(
          refundFilter,
          0,
          "latest",
        );
        const refundMapped = refundLogs.map((log) => {
          const parsed = contract.interface.parseLog(log);
          if (!parsed) {
            return null;
          }
          const args = parsed.args as unknown as {
            contributor: string;
            amount: bigint;
          };
          return {
            contributor: args.contributor,
            amount: args.amount,
            blockNumber: log.blockNumber,
            txHash: log.transactionHash,
          };
        });
        const refunds = refundMapped.filter(
          (item): item is NonNullable<typeof item> => item !== null,
        );
        setRefundHistory(refunds.reverse());

        await loadUserNames(contract, [
          campaign.creator,
          ...history.map((item) => item.contributor),
          ...claims.map((item) => item.creator),
          ...refunds.map((item) => item.contributor),
        ]);
      } finally {
        setIsLoadingDetail(false);
      }
    },
    [loadUserNames],
  );

  useEffect(() => {
    if (window.ethereum) {
      void loadCampaigns(window.ethereum);
    }
  }, [loadCampaigns]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setToast(null);
    }, 4000);

    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const ethereum = window.ethereum;
    if (!ethereum) {
      return;
    }

    const provider = new ethers.BrowserProvider(ethereum);
    const contract = new ethers.Contract(contractAddress, abi, provider);

    const refresh = () => {
      void loadCampaigns(ethereum);
      if (selectedCampaignId) {
        void loadCampaignDetail(selectedCampaignId, ethereum);
      }
    };

    contract.on("CampaignCreated", refresh);
    contract.on("Pledged", refresh);
    contract.on("Claimed", refresh);
    contract.on("Refunded", refresh);

    return () => {
      contract.removeAllListeners("CampaignCreated");
      contract.removeAllListeners("Pledged");
      contract.removeAllListeners("Claimed");
      contract.removeAllListeners("Refunded");
    };
  }, [loadCampaignDetail, loadCampaigns, selectedCampaignId]);

  useEffect(() => {
    const stored = window.localStorage.getItem("crowdfunding:favorites");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as number[];
        setFavoriteIds(parsed);
      } catch {
        setFavoriteIds([]);
      }
    }
  }, []);

  const filteredCampaigns = useMemo(() => {
    const now = Date.now();
    const search = searchTerm.trim().toLowerCase();

    const items = campaigns.map((campaign) => {
      const goalEth = Number(ethers.formatEther(campaign.goal));
      const pledgedEth = Number(ethers.formatEther(campaign.pledged));
      const progress = goalEth
        ? Math.min(100, Math.round((pledgedEth / goalEth) * 100))
        : 0;
      const remainingPct = Math.max(0, 100 - progress);
      const deadlineMs = Number(campaign.deadline) * 1000;
      const msLeft = deadlineMs - now;
      const daysLeft = Math.max(0, Math.ceil(msLeft / 86400000));

      return {
        ...campaign,
        goalEth,
        pledgedEth,
        progress,
        remainingPct,
        daysLeft,
        deadlineMs,
      };
    });

    const filtered = items.filter((item) => {
      if (search) {
        const nameMatch = item.name.toLowerCase().includes(search);
        if (!nameMatch) {
          return false;
        }
      }
      if (favoritesOnly && !favoriteIds.includes(item.id)) {
        return false;
      }
      return true;
    });
    return filtered;
  }, [campaigns, favoriteIds, favoritesOnly, searchTerm]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCampaigns.length / pageSize),
  );

  const pagedCampaigns = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCampaigns.slice(start, start + pageSize);
  }, [currentPage, filteredCampaigns, pageSize]);

  const topContributors = useMemo(() => {
    const totals: Record<string, bigint> = {};
    for (const item of pledgeHistory) {
      totals[item.contributor] =
        (totals[item.contributor] ?? BigInt(0)) + item.amount;
    }

    return Object.entries(totals)
      .map(([contributor, amount]) => ({ contributor, amount }))
      .sort((a, b) => {
        if (a.amount === b.amount) {
          return 0;
        }
        return a.amount > b.amount ? -1 : 1;
      })
      .slice(0, 5);
  }, [pledgeHistory]);

  const stats = useMemo(() => {
    const totalRaised = campaigns.reduce(
      (acc, item) => acc + Number(ethers.formatEther(item.pledged)),
      0,
    );
    const totalCampaigns = campaigns.length;
    const now = Date.now();
    const activeCampaigns = campaigns.filter(
      (item) => Number(item.deadline) * 1000 > now && !item.claimed,
    ).length;

    return {
      totalRaised,
      totalCampaigns,
      activeCampaigns,
    };
  }, [campaigns]);

  const topCampaign = useMemo(() => {
    if (campaigns.length === 0) {
      return null;
    }

    const ranked = campaigns
      .map((campaign) => ({
        ...campaign,
        pledgedEth: Number(ethers.formatEther(campaign.pledged)),
        goalEth: Number(ethers.formatEther(campaign.goal)),
      }))
      .sort((a, b) => b.pledgedEth - a.pledgedEth);

    return ranked[0];
  }, [campaigns]);

  useEffect(() => {
    setCurrentPage(1);
  }, [favoritesOnly, searchTerm]);

  function toggleFavorite(id: number) {
    setFavoriteIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((value) => value !== id)
        : [...prev, id];
      window.localStorage.setItem(
        "crowdfunding:favorites",
        JSON.stringify(next),
      );
      return next;
    });
  }
  return (
    <div className="page">
      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.message}</div>
      )}
      <div className="shell">
        <section className="hero">
          <div className="hero-content">
            <div className="hero-brand">
              <div className="logo-mark">CF</div>
              <div>
                <div className="eyebrow">
                  Huy động vốn cộng đồng trực tiếp trên blockchain
                </div>
                <span className="brand-badge">
                  Được xác minh trên mạng Sepolia
                </span>
              </div>
            </div>
            <h1 className="title">Ứng dụng góp vốn (DApp)</h1>
            <p className="subtitle">Tạo chiến dịch nhanh, gọi vốn minh bạch.</p>
            <div className="hero-actions">
              <button
                className="btn btn-primary btn-lg hero-cta"
                onClick={() =>
                  createRef.current?.scrollIntoView({
                    behavior: "smooth",
                  })
                }
              >
                Tạo chiến dịch
              </button>
              <button className="btn btn-ghost btn-sm" onClick={connectWallet}>
                Liên kết ví
              </button>
              <button
                className="btn btn-ghost btn-lg"
                onClick={() =>
                  feedRef.current?.scrollIntoView({
                    behavior: "smooth",
                  })
                }
              >
                Xem các chiến dịch
              </button>
              <span className="pill pill-ghost">
                {account
                  ? `Wallet: ${displayName(account)}`
                  : "Bạn chưa kết nối ví"}
              </span>
            </div>
            <div className="stack">
              <label className="label">Tên người dùng</label>
              {currentUserName && !isEditingUserName ? (
                <>
                  <div className="subtitle">
                    Tên hiện tại: {currentUserName}
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setIsEditingUserName(true)}
                    type="button"
                  >
                    Đổi tên
                  </button>
                </>
              ) : (
                <>
                  {account && !currentUserName && (
                    <div className="subtitle">Vui lòng đặt tên hiển thị.</div>
                  )}
                  <input
                    className="input"
                    value={userNameInput}
                    onChange={(e) => setUserNameInput(e.target.value)}
                    placeholder="Nhập tên hiển thị"
                  />
                  <div className="row">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={saveUserName}
                      disabled={txStatus === "pending"}
                      type="button"
                    >
                      Lưu tên người dùng
                    </button>
                    {currentUserName && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setUserNameInput(currentUserName);
                          setIsEditingUserName(false);
                        }}
                        type="button"
                      >
                        Hủy
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            {networkWarning && <div className="warning">{networkWarning}</div>}
          </div>
          <div className="hero-icon" aria-hidden>
            <svg viewBox="0 0 120 120">
              <defs>
                <linearGradient id="heroGlow" x1="0" x2="1">
                  <stop offset="0" stopColor="#1d4ed8" />
                  <stop offset="1" stopColor="#0f8b8d" />
                </linearGradient>
              </defs>
              <circle cx="60" cy="60" r="40" fill="url(#heroGlow)" />
              <path
                d="M40 66c8 12 32 12 40 0"
                stroke="#ffffff"
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M44 48h32"
                stroke="#ffffff"
                strokeWidth="6"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="hero-stats">
            <div className="stat-card">
              <div className="stat-label">Tổng vốn</div>
              <div className="stat-value">
                {stats.totalRaised.toFixed(3)} ETH
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Chiến dịch hoạt động</div>
              <div className="stat-value">{stats.activeCampaigns}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Tổng chiến dịch</div>
              <div className="stat-value">{stats.totalCampaigns}</div>
            </div>
          </div>
        </section>

        <div className="layout">
          <aside className="panel" ref={createRef}>
            <div className="panel-header">
              <h3 className="section-title">Khởi tạo chiến dịch</h3>
              <p className="subtitle">Xác định mục tiêu và thời gian kêu gọi</p>
            </div>
            <div className="stack">
              <label className="label">Tên chiến dịch</label>
              <input
                className="input"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Ví dụ: Quỹ học bổng 2026"
              />
              <div className="subtitle">
                {account
                  ? `Bạn đang có ${openCampaignCount}/5 chiến dịch đang mở.`
                  : "Kết nối ví để kiểm tra số chiến dịch đang mở."}
              </div>
              <label className="label">Mục tiêu huy động (ETH)</label>
              <input
                className="input"
                value={campaignGoalEth}
                onChange={(e) => {
                  const next = normalizeEthInput(e.target.value, 6);
                  if (next !== null) {
                    setCampaignGoalEth(next);
                  }
                }}
                placeholder="Mục tiêu (ETH)"
              />
              <label className="label">Thời gian kêu gọi (ngày)</label>
              <input
                className="input"
                value={campaignDurationDays}
                onChange={(e) => setCampaignDurationDays(e.target.value)}
                placeholder="Thời gian (ngày)"
              />
              <button
                className="btn btn-accent"
                onClick={createCampaign}
                disabled={txStatus === "pending"}
              >
                Tạo chiến dịch
              </button>
            </div>
            <div className="quick-card">
              <div>
                <div className="section-title">Ủng hộ nhanh</div>
                <p className="subtitle">Ủng hộ 0.01 ETH cho chiến dịch #1.</p>
              </div>
              <button className="btn btn-primary" onClick={pledge}>
                Góp vốn 0.01 ETH
              </button>
            </div>
            <div className="tx-panel">
              <div className="section-title">Giao dịch gần đây</div>
              {txHistory.length === 0 ? (
                <p className="subtitle">Không có giao dịch</p>
              ) : (
                <div className="tx-list">
                  {txHistory.map((tx) => (
                    <div className="tx-item" key={tx.hash}>
                      <div>
                        <div className="label">{tx.label}</div>
                        <a
                          className="tx-hash"
                          href={`${explorerBase}${tx.hash}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {tx.hash.slice(0, 10)}...{tx.hash.slice(-6)}
                        </a>
                      </div>
                      <span className={`tx-status tx-status-${tx.status}`}>
                        {tx.status === "pending"
                          ? "Đang xử lý..."
                          : tx.status === "success"
                            ? "Hoàn tất"
                            : "Không thành công"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>

          <section className="panel panel-main" ref={feedRef}>
            <div className="panel-header panel-header-row">
              <div>
                <h3 className="section-title">Danh sách chiến dịch</h3>
                <p className="subtitle">Lọc và sắp xếp để dễ tìm</p>
              </div>
              <button className="btn btn-ghost" onClick={() => loadCampaigns()}>
                Làm mới
              </button>
            </div>

            <div className="filters">
              <div className="filter-grid">
                <input
                  className="input input-compact"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm theo tên chiến dịch"
                />
                <button
                  className={`btn btn-ghost btn-sm ${
                    favoritesOnly ? "btn-active" : ""
                  }`}
                  onClick={() => setFavoritesOnly((prev) => !prev)}
                  type="button"
                >
                  {favoritesOnly
                    ? `Đang lọc đã theo dõi (${favoriteIds.length})`
                    : `Lọc đã theo dõi (${favoriteIds.length})`}
                </button>
              </div>
            </div>

            {isLoadingCampaigns ? (
              <div className="skeleton-grid">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div className="skeleton-card" key={`sk-${index}`} />
                ))}
              </div>
            ) : filteredCampaigns.length === 0 ? (
              <div className="empty-state">
                <div className="empty-orb" />
                <h4>
                  {favoritesOnly
                    ? "Chưa có chiến dịch đã theo dõi"
                    : "Chưa có chiến dịch nào"}
                </h4>
                <p className="subtitle">
                  {favoritesOnly
                    ? favoriteIds.length === 0
                      ? "Hãy bấm Theo dõi ở một chiến dịch để lưu lại."
                      : "Không tìm thấy chiến dịch đã theo dõi theo bộ lọc hiện tại."
                    : "Tạo chiến dịch đầu tiên để bắt đầu huy động vốn."}
                </p>
              </div>
            ) : (
              <>
                {topCampaign &&
                  (() => {
                    const progress =
                      topCampaign.goalEth > 0
                        ? Math.min(
                            100,
                            Math.round(
                              (topCampaign.pledgedEth / topCampaign.goalEth) *
                                100,
                            ),
                          )
                        : 0;
                    return (
                      <div className="top-campaign">
                        <div className="top-campaign-head">
                          <div>
                            <div className="section-title">
                              Chiến dịch hàng đầu
                            </div>
                            <p className="subtitle">
                              {topCampaign.name} · Đang dẫn đầu với số vốn{" "}
                              {topCampaign.pledgedEth.toFixed(3)} ETH
                            </p>
                          </div>
                          <span className="badge badge-live">
                            #{topCampaign.id}
                          </span>
                        </div>
                        <div className="top-campaign-metrics">
                          <div>
                            <div className="label">Mục tiêu</div>
                            <div className="value">
                              {topCampaign.goalEth.toFixed(3)} ETH
                            </div>
                          </div>
                          <div>
                            <div className="label">Đã góp</div>
                            <div className="value">
                              {topCampaign.pledgedEth.toFixed(3)} ETH
                            </div>
                          </div>
                        </div>
                        <div className="campaign-progress-head">
                          <span className="progress-label">
                            {progress}% hoàn thành
                          </span>
                          <span className="progress-total">
                            {topCampaign.pledgedEth.toFixed(3)} /{" "}
                            {topCampaign.goalEth.toFixed(3)} ETH
                          </span>
                        </div>
                        <div className="progress">
                          <div
                            className="progress-bar"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                <div className="campaigns">
                  {pagedCampaigns.map((campaign, index) => {
                    const canClaim =
                      account &&
                      account.toLowerCase() ===
                        campaign.creator.toLowerCase() &&
                      !campaign.claimed &&
                      campaign.pledged >= campaign.goal;
                    const canRefund =
                      account &&
                      !campaign.claimed &&
                      campaign.pledged < campaign.goal &&
                      campaign.deadlineMs <= Date.now();
                    const canPledge =
                      !campaign.claimed && campaign.deadlineMs > Date.now();
                    const isUrgent =
                      !campaign.claimed &&
                      campaign.deadlineMs > Date.now() &&
                      campaign.daysLeft <= 1;
                    const isExpired =
                      !campaign.claimed &&
                      campaign.pledged < campaign.goal &&
                      campaign.deadlineMs <= Date.now();
                    const isRefunded = refundedCampaignIds.includes(
                      campaign.id,
                    );
                    const statusText = campaign.claimed
                      ? "Đã nhận vốn"
                      : isExpired
                        ? isRefunded
                          ? "Đã hoàn tiền"
                          : "Đã hết hạn"
                        : "Đang mở";
                    const statusClass = campaign.claimed
                      ? "badge-muted"
                      : isExpired
                        ? isRefunded
                          ? "badge-refunded"
                          : "badge-muted"
                        : "badge-live";
                    const statusDotClass = campaign.claimed
                      ? "status-dot-muted"
                      : isExpired
                        ? isRefunded
                          ? "status-dot-refunded"
                          : "status-dot-muted"
                        : "status-dot-live";
                    let pledgeHint = "";
                    if (campaign.claimed) {
                      pledgeHint =
                        "Chiến dịch đã kết thúc nhận vốn, bạn không thể góp thêm.";
                    } else if (campaign.deadlineMs <= Date.now()) {
                      pledgeHint =
                        "Chiến dịch đã hết hạn. Không thể đóng góp thêm.";
                    }
                    let actionHint = "";
                    if (!canClaim && !canRefund) {
                      if (
                        campaign.pledged >= campaign.goal &&
                        !campaign.claimed
                      ) {
                        actionHint = "Chỉ chủ chiến dịch được phép rút tiền.";
                      } else if (campaign.pledged < campaign.goal) {
                        actionHint =
                          "Bạn chưa đạt điều kiện để nhận hoặc hoàn vốn.";
                      }
                    }

                    return (
                      <div
                        className={`campaign-card stagger ${
                          campaign.contributed ? "campaign-contributed" : ""
                        }`}
                        key={campaign.id}
                        style={{ animationDelay: `${index * 40}ms` }}
                      >
                        <div className="campaign-header">
                          <div className="campaign-meta">
                            <span className="pill">#{campaign.id}</span>
                            <div className="badges">
                              {campaign.contributed && (
                                <span className="badge badge-you">Bạn</span>
                              )}
                              {isUrgent && (
                                <span className="badge badge-urgent">
                                  <span
                                    className="status-dot status-dot-urgent"
                                    aria-hidden
                                  />
                                  Sắp hết hạn
                                </span>
                              )}
                              <span className={`badge ${statusClass}`}>
                                <span
                                  className={`status-dot ${statusDotClass}`}
                                  aria-hidden
                                />
                                {statusText}
                              </span>
                            </div>
                          </div>
                          <div className="campaign-creator">
                            <span className="label">Creator</span>
                            <span className="pill pill-ghost">
                              {displayName(campaign.creator)}
                            </span>
                          </div>
                        </div>
                        <div className="campaign-title">{campaign.name}</div>
                        <div className="campaign-kpis">
                          <div className="kpi">
                            <div className="kpi-label">
                              <span className="kpi-icon" aria-hidden>
                                <svg viewBox="0 0 24 24">
                                  <circle cx="12" cy="12" r="9" />
                                  <path d="M12 7v5l3 3" />
                                </svg>
                              </span>
                              Mục tiêu
                            </div>
                            <div className="kpi-value">
                              {campaign.goalEth.toFixed(3)} ETH
                            </div>
                          </div>
                          <div className="kpi">
                            <div className="kpi-label">
                              <span className="kpi-icon" aria-hidden>
                                <svg viewBox="0 0 24 24">
                                  <path d="M5 12h14" />
                                  <path d="M12 5v14" />
                                </svg>
                              </span>
                              Đã góp
                            </div>
                            <div className="kpi-value">
                              {campaign.pledgedEth.toFixed(3)} ETH
                            </div>
                          </div>
                          <div className="kpi">
                            <div className="kpi-label">
                              <span className="kpi-icon" aria-hidden>
                                <svg viewBox="0 0 24 24">
                                  <path d="M12 6v6l4 2" />
                                  <path d="M4 12a8 8 0 1 0 16 0" />
                                </svg>
                              </span>
                              Còn lại
                            </div>
                            <div className="kpi-value">
                              {campaign.daysLeft} ngày
                            </div>
                          </div>
                        </div>
                        <div className="campaign-progress-head">
                          <span className="progress-label">
                            {campaign.progress}% hoàn thành
                          </span>
                          <span className="progress-total">
                            {campaign.pledgedEth.toFixed(3)} /{" "}
                            {campaign.goalEth.toFixed(3)} ETH
                          </span>
                        </div>
                        <div className="progress">
                          <div
                            className="progress-bar"
                            style={{ width: `${campaign.progress}%` }}
                          />
                        </div>
                        <div className="campaign-actions">
                          <input
                            className="input input-compact"
                            value={pledgeAmounts[campaign.id] ?? ""}
                            onChange={(e) =>
                              setPledgeAmounts((prev) => {
                                const next = normalizeEthInput(
                                  e.target.value,
                                  6,
                                );
                                if (next === null) {
                                  return prev;
                                }
                                return {
                                  ...prev,
                                  [campaign.id]: next,
                                };
                              })
                            }
                            placeholder="Số ETH"
                            disabled={!canPledge}
                          />
                          <button
                            className="btn btn-primary"
                            onClick={() => pledgeToCampaign(campaign.id)}
                            disabled={txStatus === "pending" || !canPledge}
                            title={
                              !canPledge
                                ? "Không thể góp vốn vào lúc này"
                                : undefined
                            }
                          >
                            Góp vốn
                          </button>
                          {canClaim && (
                            <button
                              className="btn btn-claim"
                              onClick={() => claimCampaign(campaign.id)}
                              disabled={txStatus === "pending"}
                            >
                              Rút tiền
                            </button>
                          )}
                          {canRefund && (
                            <button
                              className="btn btn-refund"
                              onClick={() => refundCampaign(campaign.id)}
                              disabled={txStatus === "pending"}
                            >
                              Hoàn tiền
                            </button>
                          )}
                          <button
                            className="btn btn-ghost"
                            onClick={() => {
                              setSelectedCampaignId(campaign.id);
                              void loadCampaignDetail(campaign.id);
                            }}
                          >
                            Chi tiết
                          </button>
                          <button
                            className={`btn btn-ghost btn-sm ${
                              favoriteIds.includes(campaign.id)
                                ? "btn-active"
                                : ""
                            }`}
                            onClick={() => toggleFavorite(campaign.id)}
                          >
                            {favoriteIds.includes(campaign.id)
                              ? "Đã theo dõi"
                              : "Theo dõi"}
                          </button>
                        </div>
                        {(pledgeHint || actionHint) && (
                          <div className="hint">{pledgeHint || actionHint}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="pagination">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={currentPage === 1}
                  >
                    Trước
                  </button>
                  <span className="pagination-label">
                    Trang {currentPage} / {totalPages}
                  </span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    Tiếp
                  </button>
                </div>
              </>
            )}
          </section>
        </div>

        {selectedCampaignId && (
          <section className="panel detail">
            <div className="panel-header panel-header-row">
              <h3>Chi tiết chiến dịch #{selectedCampaignId}</h3>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setSelectedCampaignId(null);
                  setSelectedCampaign(null);
                  setPledgeHistory([]);
                  setClaimHistory([]);
                  setRefundHistory([]);
                }}
              >
                Đóng
              </button>
            </div>

            {isLoadingDetail || !selectedCampaign ? (
              <p className="subtitle">Đang tải chi tiết...</p>
            ) : (
              <div className="detail-grid">
                <div className="detail-wide">
                  <div className="label">Tên chiến dịch</div>
                  <div className="value">{selectedCampaign.name}</div>
                </div>
                <div className="detail-wide">
                  <div className="label">Người tạo</div>
                  <div className="address-row">
                    <span className="value detail-value-wrap">
                      {displayName(selectedCampaign.creator)}
                    </span>
                    <div className="address-actions">
                      <button
                        className="icon-button"
                        type="button"
                        onClick={() =>
                          copyToClipboard(selectedCampaign.creator, "dia chi")
                        }
                        aria-label="Copy dia chi"
                        title="Copy dia chi"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden>
                          <rect x="9" y="9" width="10" height="10" />
                          <rect x="5" y="5" width="10" height="10" />
                        </svg>
                      </button>
                      <a
                        className="icon-button"
                        href={`${explorerAddressBase}${selectedCampaign.creator}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Mở Etherscan"
                        title="Mở Etherscan"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden>
                          <path d="M14 5h5v5" />
                          <path d="M10 14l9-9" />
                          <path d="M5 7v12h12" />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="label">Mục tiêu</div>
                  <div className="value">
                    {Number(ethers.formatEther(selectedCampaign.goal)).toFixed(
                      3,
                    )}{" "}
                    ETH
                  </div>
                </div>
                <div>
                  <div className="label">Đã góp</div>
                  <div className="value">
                    {Number(
                      ethers.formatEther(selectedCampaign.pledged),
                    ).toFixed(3)}{" "}
                    ETH
                  </div>
                </div>
                <div>
                  <div className="label">Thời hạn</div>
                  <div className="value">
                    {new Date(
                      Number(selectedCampaign.deadline) * 1000,
                    ).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="label">Trạng thái</div>
                  <div className="value">
                    {(() => {
                      const isExpired =
                        !selectedCampaign.claimed &&
                        selectedCampaign.pledged < selectedCampaign.goal &&
                        Number(selectedCampaign.deadline) * 1000 <= Date.now();
                      if (selectedCampaign.claimed) {
                        return "Đã rút tiền";
                      }
                      if (isExpired) {
                        return refundedCampaignIds.includes(selectedCampaign.id)
                          ? "Đã hoàn tiền"
                          : "Đã hết hạn";
                      }
                      return "Đang mở";
                    })()}
                  </div>
                </div>
              </div>
            )}

            {selectedCampaign && (
              <div className="detail-actions">
                {(() => {
                  const isCreator =
                    account &&
                    account.toLowerCase() ===
                      selectedCampaign.creator.toLowerCase();
                  const isEnded =
                    Number(selectedCampaign.deadline) * 1000 <= Date.now();
                  const isGoalReached =
                    selectedCampaign.pledged >= selectedCampaign.goal;
                  const canClaimDetail =
                    isCreator && !selectedCampaign.claimed && isGoalReached;
                  const canRefundDetail =
                    !selectedCampaign.claimed && isEnded && !isGoalReached;
                  const hint =
                    !canClaimDetail && !canRefundDetail
                      ? isGoalReached
                        ? "Chỉ người tạo mới có thể rút vốn."
                        : "Chưa đạt điều kiện rút hoặc hoàn vốn."
                      : "";

                  return (
                    <>
                      {canClaimDetail && (
                        <button
                          className="btn btn-claim"
                          onClick={() => claimCampaign(selectedCampaign.id)}
                          disabled={txStatus === "pending"}
                        >
                          Rút tiền
                        </button>
                      )}
                      {canRefundDetail && (
                        <button
                          className="btn btn-refund"
                          onClick={() => refundCampaign(selectedCampaign.id)}
                          disabled={txStatus === "pending"}
                        >
                          Hoàn tiền
                        </button>
                      )}
                      {hint && <div className="hint">{hint}</div>}
                    </>
                  );
                })()}
              </div>
            )}

            <div className="detail-tabs">
              {[
                { key: "contributors", label: "Đóng góp nổi bật" },
                { key: "pledges", label: "Lịch sử góp" },
                { key: "claims", label: "Lịch sử rút vốn" },
                { key: "refunds", label: "Lịch sử hoàn vốn" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  className={`tab ${
                    activeDetailTab === tab.key ? "tab-active" : ""
                  }`}
                  onClick={() => setActiveDetailTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeDetailTab === "contributors" && (
              <div className="detail-section">
                <h4>Người ủng hộ nổi bật</h4>
                {topContributors.length === 0 ? (
                  <p className="subtitle">Chưa có đóng góp nào</p>
                ) : (
                  <div className="contributors">
                    {topContributors.map((item) => (
                      <div className="contributor" key={item.contributor}>
                        <div className="address-row">
                          <span className="pill">
                            {displayName(item.contributor)}
                          </span>
                          <div className="address-actions">
                            <button
                              className="icon-button"
                              type="button"
                              onClick={() =>
                                copyToClipboard(item.contributor, "địa chỉ")
                              }
                              aria-label="Copy địa chỉ"
                              title="Copy địa chỉ"
                            >
                              <svg viewBox="0 0 24 24" aria-hidden>
                                <rect x="9" y="9" width="10" height="10" />
                                <rect x="5" y="5" width="10" height="10" />
                              </svg>
                            </button>
                            <a
                              className="icon-button"
                              href={`${explorerAddressBase}${item.contributor}`}
                              target="_blank"
                              rel="noreferrer"
                              aria-label="Mở Etherscan"
                              title="Mở Etherscan"
                            >
                              <svg viewBox="0 0 24 24" aria-hidden>
                                <path d="M14 5h5v5" />
                                <path d="M10 14l9-9" />
                                <path d="M5 7v12h12" />
                              </svg>
                            </a>
                          </div>
                        </div>
                        <span className="value">
                          {Number(ethers.formatEther(item.amount)).toFixed(4)}{" "}
                          ETH
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeDetailTab === "claims" && (
              <div className="detail-section">
                <h4>Lịch sử rút vốn</h4>
                {claimHistory.length === 0 ? (
                  <p className="subtitle">Chưa có đóng góp nào</p>
                ) : (
                  <div className="history">
                    {claimHistory.map((item, index) => (
                      <div
                        className="history-item"
                        key={`${item.txHash}-${index}`}
                      >
                        <div>
                          <div className="label">Người tạo</div>
                          <div className="address-row">
                            <span className="value">
                              {displayName(item.creator)}
                            </span>
                            <div className="address-actions">
                              <button
                                className="icon-button"
                                type="button"
                                onClick={() =>
                                  copyToClipboard(item.creator, "địa chỉ")
                                }
                                aria-label="Copy địa chỉ"
                                title="Copy địa chỉ"
                              >
                                <svg viewBox="0 0 24 24" aria-hidden>
                                  <rect x="9" y="9" width="10" height="10" />
                                  <rect x="5" y="5" width="10" height="10" />
                                </svg>
                              </button>
                              <a
                                className="icon-button"
                                href={`${explorerAddressBase}${item.creator}`}
                                target="_blank"
                                rel="noreferrer"
                                aria-label="Mở Etherscan"
                                title="Mở Etherscan"
                              >
                                <svg viewBox="0 0 24 24" aria-hidden>
                                  <path d="M14 5h5v5" />
                                  <path d="M10 14l9-9" />
                                  <path d="M5 7v12h12" />
                                </svg>
                              </a>
                            </div>
                          </div>
                        </div>
                        <div>
                          <div className="label">Số vốn</div>
                          <div className="value">
                            {Number(ethers.formatEther(item.amount)).toFixed(4)}{" "}
                            ETH
                          </div>
                        </div>
                        <div>
                          <div className="label">Block</div>
                          <div className="value">{item.blockNumber}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeDetailTab === "refunds" && (
              <div className="detail-section">
                <h4>Lịch sử hoàn vốn</h4>
                {refundHistory.length === 0 ? (
                  <p className="subtitle">Chưa có hoàn vốn nào.</p>
                ) : (
                  <div className="history">
                    {refundHistory.map((item, index) => (
                      <div
                        className="history-item"
                        key={`${item.txHash}-${index}`}
                      >
                        <div>
                          <div className="label">Người đóng góp</div>
                          <div className="address-row">
                            <span className="value">
                              {displayName(item.contributor)}
                            </span>
                            <div className="address-actions">
                              <button
                                className="icon-button"
                                type="button"
                                onClick={() =>
                                  copyToClipboard(item.contributor, "địa chỉ")
                                }
                                aria-label="Copy địa chỉ"
                                title="Copy địa chỉ"
                              >
                                <svg viewBox="0 0 24 24" aria-hidden>
                                  <rect x="9" y="9" width="10" height="10" />
                                  <rect x="5" y="5" width="10" height="10" />
                                </svg>
                              </button>
                              <a
                                className="icon-button"
                                href={`${explorerAddressBase}${item.contributor}`}
                                target="_blank"
                                rel="noreferrer"
                                aria-label="Mở Etherscan"
                                title="Mở Etherscan"
                              >
                                <svg viewBox="0 0 24 24" aria-hidden>
                                  <path d="M14 5h5v5" />
                                  <path d="M10 14l9-9" />
                                  <path d="M5 7v12h12" />
                                </svg>
                              </a>
                            </div>
                          </div>
                        </div>
                        <div>
                          <div className="label">Số vốn</div>
                          <div className="value">
                            {Number(ethers.formatEther(item.amount)).toFixed(4)}{" "}
                            ETH
                          </div>
                        </div>
                        <div>
                          <div className="label">Block</div>
                          <div className="value">{item.blockNumber}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeDetailTab === "pledges" && (
              <div className="detail-section">
                <h4>Lịch sử đóng góp</h4>
                {pledgeHistory.length === 0 ? (
                  <p className="subtitle">Chưa có đóng góp nào</p>
                ) : (
                  <div className="history">
                    {pledgeHistory.map((item, index) => (
                      <div
                        className="history-item"
                        key={`${item.txHash}-${index}`}
                      >
                        <div>
                          <div className="label">Người đóng góp</div>
                          <div className="address-row">
                            <span className="value">
                              {displayName(item.contributor)}
                            </span>
                            <div className="address-actions">
                              <button
                                className="icon-button"
                                type="button"
                                onClick={() =>
                                  copyToClipboard(item.contributor, "địa chỉ")
                                }
                                aria-label="Copy địa chỉ"
                                title="Copy địa chỉ"
                              >
                                <svg viewBox="0 0 24 24" aria-hidden>
                                  <rect x="9" y="9" width="10" height="10" />
                                  <rect x="5" y="5" width="10" height="10" />
                                </svg>
                              </button>
                              <a
                                className="icon-button"
                                href={`${explorerAddressBase}${item.contributor}`}
                                target="_blank"
                                rel="noreferrer"
                                aria-label="Mở Etherscan"
                                title="Mở Etherscan"
                              >
                                <svg viewBox="0 0 24 24" aria-hidden>
                                  <path d="M14 5h5v5" />
                                  <path d="M10 14l9-9" />
                                  <path d="M5 7v12h12" />
                                </svg>
                              </a>
                            </div>
                          </div>
                        </div>
                        <div>
                          <div className="label">Số vốn</div>
                          <div className="value">
                            {Number(ethers.formatEther(item.amount)).toFixed(4)}{" "}
                            ETH
                          </div>
                        </div>
                        <div>
                          <div className="label">Block</div>
                          <div className="value">{item.blockNumber}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>
      <div className="mobile-cta">
        <button
          className="btn btn-primary"
          onClick={() =>
            createRef.current?.scrollIntoView({
              behavior: "smooth",
            })
          }
        >
          Tạo chiến dịch
        </button>
        <button
          className="btn btn-ghost"
          onClick={() =>
            feedRef.current?.scrollIntoView({
              behavior: "smooth",
            })
          }
        >
          Khám phá
        </button>
      </div>
    </div>
  );
}
