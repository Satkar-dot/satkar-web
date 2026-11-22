"use client";
import React, { useState, useEffect, useRef } from "react";

interface Product {
  _id: string;
  title: string;
  description: string;
  price: number;
  discountPrice: number;
  category: string;
  images: string[];
  stock: number;
  sellerName: string;
  quantity?: number;
}

const ORDER_STATUSES = ["Pending", "Confirmed", "Shipped", "Delivered"] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

interface Order {
  _id: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
  items: { productId?: string; title: string; price: number; quantity: number }[];
  totalAmount: number;
  paymentMethod?: string;
  paymentStatus?: string;
  razorpayOrderId?: string;
  status: OrderStatus;
  createdAt: string;
}

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  shopName?: string;
}

interface RazorpayWindow extends Window {
  Razorpay?: new (options: Record<string, unknown>) => {
    open: () => void;
    close: () => void;
  };
}

declare const window: RazorpayWindow;

const CATEGORY_PILLS = [
  "All",
  "Electronics",
  "Fashion",
  "Home & Kitchen",
  "Industrial & Tools",
] as const;

export default function SatkarHome() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [updatingOrderIds, setUpdatingOrderIds] = useState<Set<string>>(new Set());
  const [cart, setCart] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"All" | "Electronics" | "Fashion" | "Home & Kitchen" | "Industrial & Tools">("All");
  const [activeTab, setActiveTab] = useState<"store" | "cart" | "seller" | "orders" | "auth">("store");
  const [loading, setLoading] = useState(true);
  const [productsError, setProductsError] = useState("");

  const [user, setUser] = useState<UserData | null>(null);

  // Modal state
  const [modalProduct, setModalProduct] = useState<Product | null>(null);

  // Auth Form State
  const [isSignup, setIsSignup] = useState(false);
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authRole, setAuthRole] = useState<"customer" | "seller">("customer");
  const [authShopName, setAuthShopName] = useState("");

  // Order Form State
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [paymentMode, setPaymentMode] = useState<"COD" | "ONLINE">("COD");

  // Seller Add Product State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [discountPrice, setDiscountPrice] = useState("");
  const [sellerCategory, setSellerCategory] = useState("Electronics");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [sellerName, setSellerName] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);

  const fetchProducts = async () => {
    setLoading(true);
    setProductsError("");
    try {
      let lastError: Error | null = null;
      for (let attempt = 0; attempt <= 3; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
          const res = await fetch("https://satkar-api.onrender.com/api/products", {
            signal: controller.signal,
          });
          if (!res.ok) {
            throw new Error(`Products request failed (${res.status}).`);
          }
          const data = await res.json();
          if (!Array.isArray(data)) {
            throw new Error("The products service returned an invalid response.");
          }
          setProducts(data);
          return;
        } catch (error) {
          clearTimeout(timeout);
          lastError = error instanceof Error ? error : new Error("Unable to load products.");
          if (attempt === 3) break;
          await new Promise((resolve) => setTimeout(resolve, 5000));
        } finally {
          clearTimeout(timeout);
        }
      }
      throw lastError || new Error("Unable to load products.");
    } catch (error) {
      console.error("Error fetching products:", error);
      setProductsError(
        error instanceof Error ? error.message : "Unable to load products.",
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch("https://satkar-api.onrender.com/api/orders");
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching orders:", error);
    }
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    const previousStatus = orders.find((order) => order._id === orderId)?.status;
    if (!previousStatus) return;

    setUpdatingOrderIds((current) => new Set(current).add(orderId));
    setOrders((current) =>
      current.map((order) => (order._id === orderId ? { ...order, status } : order))
    );

    try {
      const res = await fetch(`https://satkar-api.onrender.com/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Order status update failed.");

      setOrders((current) =>
        current.map((order) => (order._id === orderId ? data.order : order))
      );
    } catch (error) {
      console.error("Error updating order status:", error);
      setOrders((current) =>
        current.map((order) =>
          order._id === orderId ? { ...order, status: previousStatus } : order
        )
      );
      alert(error instanceof Error ? error.message : "Order status update failed.");
    } finally {
      setUpdatingOrderIds((current) => {
        const next = new Set(current);
        next.delete(orderId);
        return next;
      });
    }
  };

  const isOrderStatus = (status: string): status is OrderStatus =>
    ORDER_STATUSES.some((allowedStatus) => allowedStatus === status);

  useEffect(() => {
    const init = async () => {
      await fetchProducts();
      await fetchOrders();
      const savedUser = localStorage.getItem("satkar_user");
      if (savedUser) {
        try {
          const parsedUser = JSON.parse(savedUser);
          setUser(parsedUser);
          setCustomerName(parsedUser.name || "");
          setSellerName(parsedUser.shopName || parsedUser.name || "");
        } catch (e) {
          console.error("Failed to parse saved user", e);
        }
      }
    };
    void init();
  }, []);

  // Razorpay Script Loader
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = isSignup ? "/api/auth/signup" : "/api/auth/login";
    const payload = isSignup
      ? {
          name: authName,
          email: authEmail,
          password: authPassword,
          phone: authPhone,
          role: authRole,
          shopName: authRole === "seller" ? authShopName : "",
        }
      : { email: authEmail, password: authPassword };

    try {
      const res = await fetch(`https://satkar-api.onrender.com${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) return alert(data.message || "Authentication failed!");

      if (isSignup) {
        alert("Account ban gaya! Ab kripya login karein.");
        setIsSignup(false);
      } else {
        localStorage.setItem("satkar_token", data.token);
        localStorage.setItem("satkar_user", JSON.stringify(data.user));
        setUser(data.user);
        setCustomerName(data.user.name);
        setSellerName(data.user.shopName || data.user.name);
        alert(`Swagat hai, ${data.user.name}!`);
        setActiveTab("store");
      }
    } catch {
      alert("Server se connect nahi ho paaya.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("satkar_token");
    localStorage.removeItem("satkar_user");
    setUser(null);
    alert("Aap logout ho gaye hain.");
    setActiveTab("store");
  };

  const addToCart = (product: Product) => {
    setCart([...cart, { ...product, quantity: 1 }]);
    alert(`${product.title} Cart mein add ho gaya!`);
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const increaseQty = (index: number) => {
    setCart(cart.map((item, i) => (i === index ? { ...item, quantity: (item.quantity || 1) + 1 } : item)));
  };

  const decreaseQty = (index: number) => {
    setCart(cart.map((item, i) => (i === index && (item.quantity || 1) > 1 ? { ...item, quantity: (item.quantity || 1) - 1 } : item)));
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return alert("Cart khaali hai!");

    const totalAmount = cart.reduce((sum, item) => sum + item.discountPrice * (item.quantity || 1), 0);
    const orderDetails = {
      customerName,
      customerPhone,
      shippingAddress,
      items: cart.map((item) => ({
        productId: item._id,
        title: item.title,
        price: item.discountPrice,
        quantity: 1,
      })),
      totalAmount,
    };

    // 1. Agar Cash on Delivery (COD) chuna hai
    if (paymentMode === "COD") {
      try {
        const res = await fetch("https://satkar-api.onrender.com/api/orders/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...orderDetails, paymentMethod: "COD", paymentStatus: "Pending" }),
        });
        if (res.ok) {
          alert("Badhai ho! Aapka COD order place ho gaya hai!");
          setCart([]);
          setShippingAddress("");
          fetchOrders();
          setActiveTab("orders");
        }
      } catch {
        alert("Order place karne mein error aaya.");
      }
      return;
    }

    // 2. Agar Online Payment (Razorpay) chuna hai
    const isLoaded = await loadRazorpayScript();
    if (!isLoaded) return alert("Razorpay SDK load nahi ho paaya. Internet check karein.");

    try {
      const orderRes = await fetch("https://satkar-api.onrender.com/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: totalAmount }),
      });
      const rzpData = await orderRes.json();

      if (!orderRes.ok) {
        return alert(rzpData.message || "Online payment order create nahi ho saka.");
      }

      if (!rzpData.keyId || !rzpData.orderId || !rzpData.amount || !rzpData.currency) {
        return alert("Payment service se valid checkout details nahi mili.");
      }

      const options = {
        key: rzpData.keyId,
        amount: rzpData.amount,
        currency: rzpData.currency,
        name: "SATKAR Marketplace",
        description: "Order Payment",
        order_id: rzpData.orderId,
        method: {
          upi: true,
          card: true,
          netbanking: true,
          wallet: true,
        },
        config: {
          display: {
            blocks: {
              upi: {
                name: "Pay via UPI (GPay, PhonePe, Paytm, BHIM and UPI QR)",
                instruments: [{ method: "upi" }],
              },
            },
            sequence: ["block.upi", "block.card", "block.netbanking", "block.wallet"],
            preferences: { show_default_blocks: true },
          },
        },
        handler: async function (response: Record<string, unknown>) {
          const verifyRes = await fetch("https://satkar-api.onrender.com/api/payment/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              orderDetails,
            }),
          });
          if (verifyRes.ok) {
            alert("Payment Successful! Aapka Online Order Confirm ho gaya hai!");
            setCart([]);
            setShippingAddress("");
            fetchOrders();
            setActiveTab("orders");
          }
        },
        prefill: {
          name: customerName,
          contact: customerPhone,
        },
        theme: { color: "#2563EB" },
      };

      const paymentObject = new window.Razorpay!(options);
      paymentObject.open();
    } catch {
      alert("Online payment start karne mein error aaya.");
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("price", price);
    formData.append("discountPrice", discountPrice);
    formData.append("category", sellerCategory);
    formData.append("stock", "20");
    formData.append("sellerName", sellerName || user?.shopName || "Satkar Partner");
    if (imageFile) {
      formData.append("image", imageFile);
    } else {
      formData.append(
        "imageUrl",
        imageUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500"
      );
    }

    setIsPublishing(true);
    try {
      const res = await fetch("https://satkar-api.onrender.com/api/products/add", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Product add karne mein error aaya.");

      alert("Naya Product Satkar Store mein live ho gaya!");
      setTitle("");
      setDescription("");
      setPrice("");
      setDiscountPrice("");
      setImageUrl("");
      setImageFile(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
      fetchProducts();
      setActiveTab("store");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Product add karne mein error aaya.");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm("Kya aap is product ko delete karna chahte hain?")) return;
    try {
      const res = await fetch(`https://satkar-api.onrender.com/api/products/${productId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Delete failed.");
      alert("Product delete ho gaya!");
      fetchProducts();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Product delete karne mein error aaya.");
    }
  };

  const openProductModal = (product: Product) => {
    setModalProduct(product);
  };

  const closeProductModal = () => {
    setModalProduct(null);
  };

  const filteredProducts = products.filter(
    (p) =>
      (selectedCategory === "All" || p.category === selectedCategory) &&
      (p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.category.toLowerCase().includes(search.toLowerCase()))
  );

  const totalCartPrice = cart.reduce((sum, item) => sum + item.discountPrice, 0);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800">
      {/* Top Navbar */}
      <header className="bg-blue-600 text-white sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div onClick={() => setActiveTab("store")} className="cursor-pointer flex items-center gap-2">
            <span className="text-2xl font-extrabold tracking-wide">SATKAR</span>
            <span className="text-xs bg-yellow-400 text-blue-900 font-bold px-2 py-0.5 rounded">
              Marketplace
            </span>
          </div>

          <input
            type="text"
            placeholder="Search products, brands and more..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] max-w-md px-4 py-2 rounded bg-white text-gray-800 focus:outline-none"
          />

          <div className="flex flex-wrap items-center gap-2 md:gap-3 font-medium text-sm">
            <button
              onClick={() => setActiveTab("store")}
              className={`px-3 py-1.5 rounded ${activeTab === "store" ? "bg-blue-800" : "hover:bg-blue-700"}`}
            >
              Shop
            </button>
            <button
              onClick={() => setActiveTab("seller")}
              className={`px-3 py-1.5 rounded ${activeTab === "seller" ? "bg-blue-800" : "hover:bg-blue-700"}`}
            >
              Sell on Satkar
            </button>
            <button
              onClick={() => {
                fetchOrders();
                setActiveTab("orders");
              }}
              className={`px-3 py-1.5 rounded ${activeTab === "orders" ? "bg-blue-800" : "hover:bg-blue-700"}`}
            >
              Orders ({orders.length})
            </button>
            <button
              onClick={() => setActiveTab("cart")}
              className="bg-yellow-400 text-blue-950 font-bold px-3 py-1.5 rounded hover:bg-yellow-300"
            >
              Cart ({cart.length})
            </button>

            {user ? (
              <div className="flex items-center gap-2 bg-blue-800 px-3 py-1.5 rounded">
                <span>Hi, {user.name.split(" ")[0]}</span>
                <button
                  onClick={handleLogout}
                  className="text-xs bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded text-white"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={() => setActiveTab("auth")}
                className="bg-white text-blue-700 font-bold px-3 py-1.5 rounded hover:bg-gray-100"
              >
                Login
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4 md:p-6">
        {activeTab === "store" && (
          <>
            <div className="bg-gradient-to-r from-indigo-600 to-blue-500 text-white rounded-xl p-6 md:p-10 mb-8 shadow">
              <h1 className="text-3xl md:text-4xl font-bold mb-2">Swagat Hai Satkar Marketplace Mein!</h1>
              <p className="text-blue-100 text-lg">
                Best Deals, Trusted Sellers aur Fast Delivery — Seedha Aapke Ghar Tak.
              </p>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-3 mb-6">
              {CATEGORY_PILLS.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    selectedCategory === cat
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <h2 className="text-2xl font-bold mb-4">Trending Products</h2>
            {loading ? (
              <p className="text-center py-10 text-gray-500">
                Server wake up ho raha hai, products load ho rahe hain... (30-40 sec)
              </p>
            ) : productsError && products.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-gray-500 mb-4">
                  Products load nahi ho paaye. {productsError}
                </p>
                <button
                  type="button"
                  onClick={() => void fetchProducts()}
                  className="px-5 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
                >
                  Retry
                </button>
              </div>
            ) : filteredProducts.length === 0 ? (
              <p className="text-center py-10 text-gray-500">Koi product nahi mila.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {filteredProducts.map((product) => (
                  <div
                    key={product._id}
                    className="bg-white rounded-xl shadow hover:shadow-lg transition overflow-hidden flex flex-col"
                  >
                    <div className="relative group">
                      <img
                        src={product.images[0] || "https://via.placeholder.com/300"}
                        alt={product.title}
                        className="w-full h-48 object-cover cursor-pointer hover:scale-105 transition"
                        onClick={() => openProductModal(product)}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(product);
                        }}
                        className="absolute top-3 right-3 bg-white text-gray-800 p-2 rounded-full shadow opacity-0 group-hover:opacity-100 transition"
                        title="Add to Cart"
                      >
                        +
                      </button>
                      {user && user.role === "seller" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProduct(product._id);
                          }}
                          className="absolute top-3 left-3 bg-red-500 text-white p-2 rounded-full shadow opacity-0 group-hover:opacity-100 transition"
                          title="Delete Product"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <span className="text-xs text-blue-600 font-semibold uppercase mb-1 block">
                        {product.category}
                      </span>
                      <h3 className="font-bold text-lg mb-1 line-clamp-2 cursor-pointer" onClick={() => openProductModal(product)}>
                        {product.title}
                      </h3>
                      <p className="text-gray-500 text-sm mt-1 line-clamp-2">{product.description}</p>
                      <p className="text-xs text-gray-400 mt-auto">
                        Seller: <span className="font-medium text-gray-600">{product.sellerName}</span>
                      </p>
                    </div>
                    <div className="p-4 pt-0 border-t">
                      <div className="flex items-baseline gap-2 mb-3">
                        <span className="text-xl font-bold text-gray-900">₹{product.discountPrice}</span>
                        <span className="text-sm text-gray-400 line-through">₹{product.price}</span>
                        <span className="text-xs text-green-600 font-bold">
                          {Math.round(((product.price - product.discountPrice) / product.price) * 100)}% OFF
                        </span>
                      </div>
                      <button
                        onClick={() => addToCart(product)}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 rounded-lg transition"
                      >
                        Add to Cart
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "auth" && (
          <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow">
            <h2 className="text-2xl font-bold mb-1">{isSignup ? "Create Satkar Account" : "Login to Satkar"}</h2>
            <p className="text-gray-500 text-sm mb-6">
              {isSignup ? "Customer ya Seller ke roop mein account banayein." : "Apne email aur password se login karein."}
            </p>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {isSignup && (
                <>
                  <input
                    type="text"
                    required
                    placeholder="Poora Naam"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    className="w-full border p-2.5 rounded"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="Mobile Number"
                    value={authPhone}
                    onChange={(e) => setAuthPhone(e.target.value)}
                    className="w-full border p-2.5 rounded"
                  />
                  <select
                    value={authRole}
                    onChange={(e) => setAuthRole(e.target.value as "customer" | "seller")}
                    className="w-full border p-2.5 rounded bg-gray-50 font-medium"
                  >
                    <option value="customer">Account Type: Customer (Buyer)</option>
                    <option value="seller">Account Type: Seller (Dukaandar)</option>
                  </select>
                  {authRole === "seller" && (
                    <input
                      type="text"
                      required
                      placeholder="Shop / Business Name"
                      value={authShopName}
                      onChange={(e) => setAuthShopName(e.target.value)}
                      className="w-full border p-2.5 rounded border-blue-400"
                    />
                  )}
                </>
              )}
              <input
                type="email"
                required
                placeholder="Email Address"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full border p-2.5 rounded"
              />
              <input
                type="password"
                required
                placeholder="Password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full border p-2.5 rounded"
              />
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg">
                {isSignup ? "Sign Up" : "Login"}
              </button>
            </form>

            <p className="text-center text-sm text-gray-600 mt-4">
              {isSignup ? "Pehle se account hai? " : "Naya account banana hai? "}
              <button onClick={() => setIsSignup(!isSignup)} className="text-blue-600 font-bold hover:underline">
                {isSignup ? "Login Karein" : "Sign Up Karein"}
              </button>
            </p>
          </div>
        )}

        {activeTab === "orders" && (
          <div className="max-w-5xl mx-auto bg-white p-6 rounded-xl shadow">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold">Orders Dashboard</h2>
                <p className="text-gray-500 text-sm">Sabhi live COD aur Online Paid orders.</p>
              </div>
              <button
                onClick={fetchOrders}
                className="bg-blue-100 text-blue-700 font-semibold px-4 py-2 rounded-lg hover:bg-blue-200"
              >
                Refresh Orders
              </button>
            </div>

            {orders.length === 0 ? (
              <p className="text-gray-500 py-8 text-center">Abhi tak koi order nahi aaya hai.</p>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <div
                    key={order._id}
                    className="border rounded-xl p-4 flex flex-col md:flex-row justify-between gap-4 bg-gray-50"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-lg">{order.customerName}</span>
                        <span className="text-xs bg-green-100 text-green-800 font-bold px-2.5 py-0.5 rounded-full">
                          {order.status}
                        </span>
                        <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2.5 py-0.5 rounded-full">
                          {order.paymentMethod || "COD"} ({order.paymentStatus || "Pending"})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <label htmlFor={`order-status-${order._id}`} className="text-sm text-gray-600">
                          Delivery status:
                        </label>
                        <select
                          id={`order-status-${order._id}`}
                          value={order.status}
                          disabled={updatingOrderIds.has(order._id)}
                          onChange={(event) => {
                            if (isOrderStatus(event.target.value)) {
                              void updateOrderStatus(order._id, event.target.value);
                            }
                          }}
                          className="border border-gray-300 rounded-md px-2 py-1 text-sm disabled:opacity-60"
                        >
                          {ORDER_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        {updatingOrderIds.has(order._id) && (
                          <span className="text-xs text-gray-500">Updating...</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">Phone: {order.customerPhone}</p>
                      <p className="text-sm text-gray-600">Address: {order.shippingAddress}</p>
                      <div className="mt-2">
                        <p className="text-xs font-bold text-gray-500 uppercase">Items Ordered:</p>
                        <ul className="list-disc list-inside text-sm text-gray-800">
                          {order.items.map((item, i) => (
                            <li key={i}>
                              {item.title} — ₹{item.price}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="text-left md:text-right flex flex-col justify-between">
                      <div>
                        <p className="text-xs text-gray-400">Total Bill</p>
                        <p className="text-2xl font-extrabold text-blue-700">₹{order.totalAmount}</p>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        Date: {new Date(order.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "cart" && (
          <div className="max-w-3xl mx-auto bg-white p-6 rounded-xl shadow">
            <h2 className="text-2xl font-bold mb-4">Your Shopping Cart ({cart.length})</h2>
            {cart.length === 0 ? (
              <p className="text-gray-500">Aapka cart abhi khaali hai.</p>
            ) : (
              <>
                <div className="divide-y mb-6">
                  {cart.map((item, idx) => (
                    <div key={idx} className="py-3 flex justify-between items-center gap-4">
                      <div className="flex-1">
                        <p className="font-semibold">{item.title}</p>
                        <p className="text-xs text-gray-500">Seller: {item.sellerName}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          Stock available: {item.stock}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => decreaseQty(idx)}
                          className="w-8 h-8 rounded border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-bold">{item.quantity || 1}</span>
                        <button
                          onClick={() => increaseQty(idx)}
                          className="w-8 h-8 rounded border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeFromCart(idx)}
                          className="text-red-500 hover:text-red-700 font-bold"
                        >
                          Remove
                        </button>
                      </div>
                      <span className="font-bold">₹{item.discountPrice * (item.quantity || 1)}</span>
                    </div>
                  ))}
                </div>
                <div className="text-right text-xl font-bold mb-6">Total Amount: ₹{totalCartPrice}</div>

                <form onSubmit={handlePlaceOrder} className="space-y-4 border-t pt-4">
                  <h3 className="font-bold text-lg">Delivery & Payment Option</h3>
                  <input
                    type="text"
                    required
                    placeholder="Aapka Poora Naam"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full border p-2.5 rounded"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="Mobile Number"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full border p-2.5 rounded"
                  />
                  <textarea
                    required
                    placeholder="Poora Pata (House No, Street, City, Pincode)"
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    className="w-full border p-2.5 rounded"
                  />

                  {/* Payment Mode Selector */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMode("COD")}
                      className={`p-3 rounded-lg border font-bold text-sm ${
                        paymentMode === "COD"
                          ? "bg-blue-50 border-blue-600 text-blue-700"
                          : "bg-white text-gray-600"
                      }`}
                    >
                      Cash on Delivery (COD)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMode("ONLINE")}
                      className={`p-3 rounded-lg border font-bold text-sm ${
                        paymentMode === "ONLINE"
                          ? "bg-blue-50 border-blue-600 text-blue-700"
                          : "bg-white text-gray-600"
                      }`}
                    >
                      Pay Online (PhonePe, GPay, Paytm, UPI & Card)
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg"
                  >
                    {paymentMode === "COD"
                      ? `Confirm COD Order (₹${totalCartPrice})`
                      : `Pay ₹${totalCartPrice} Online Now`}
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        {activeTab === "seller" && (
          <div className="max-w-3xl mx-auto bg-white p-6 rounded-xl shadow">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Satkar Seller Center</h2>
                <p className="text-gray-500">Apna naya product Satkar Marketplace par list karein.</p>
              </div>
              {user && user.role === "seller" && (
                <button
                  onClick={() => {
                    fetchOrders();
                    setActiveTab("orders");
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg"
                >
                  View My Orders
                </button>
              )}
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <form onSubmit={handleAddProduct} className="space-y-4">
              <input
                type="text"
                required
                placeholder="Shop / Seller Name"
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                className="w-full border p-2.5 rounded"
              />
              <input
                type="text"
                required
                placeholder="Product Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border p-2.5 rounded"
              />
              <textarea
                required
                placeholder="Product Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border p-2.5 rounded"
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="number"
                  required
                  placeholder="MRP Price (₹)"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full border p-2.5 rounded"
                />
                <input
                  type="number"
                  required
                  placeholder="Offer / Selling Price (₹)"
                  value={discountPrice}
                  onChange={(e) => setDiscountPrice(e.target.value)}
                  className="w-full border p-2.5 rounded"
                />
              </div>
              <select
                value={sellerCategory}
                onChange={(e) => setSellerCategory(e.target.value)}
                className="w-full border p-2.5 rounded"
              >
                <option value="Electronics">Electronics</option>
                <option value="Fashion">Fashion</option>
                <option value="Home & Kitchen">Home & Kitchen</option>
                <option value="Industrial & Tools">Industrial & Tools</option>
              </select>
              <input
                type="url"
                placeholder="Product Image URL (Optional)"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full border p-2.5 rounded"
              />
              <div>
                <label htmlFor="product-image" className="block text-sm font-medium mb-1">
                  Or upload a photo from your device
                </label>
                <input
                  ref={imageInputRef}
                  id="product-image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="w-full border p-2.5 rounded"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Maximum file size: 10 MB. An uploaded photo takes precedence over the image URL.
                </p>
                {imageFile && <p className="text-sm text-gray-600 mt-1">{imageFile.name}</p>}
              </div>
              <button
                type="submit"
                disabled={isPublishing}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg disabled:opacity-60"
              >
                {isPublishing ? "Publishing..." : "Publish Product to Satkar"}
              </button>
            </form>
              </div>

              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-bold text-lg mb-4">Your Products</h3>
                {products.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No products added yet.</p>
                ) : (
                  <div className="space-y-3">
                    {products.map((product) => (
                      <div
                        key={product._id}
                        className="flex justify-between items-center p-3 border rounded bg-white"
                      >
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{product.title}</p>
                          <p className="text-xs text-gray-500">
                            {product.category} • ₹{product.discountPrice}
                          </p>
                          <p className="text-xs text-gray-400">Stock: {product.stock}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteProduct(product._id)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Product Detail Modal */}
      {modalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={closeProductModal}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 my-8 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <button onClick={closeProductModal} className="text-gray-400 hover:text-gray-600 text-2xl">
                ×
              </button>
              <span className="text-xs text-blue-600 font-semibold uppercase">{modalProduct.category}</span>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="relative">
                <img
                  src={modalProduct.images[0] || "https://via.placeholder.com/400"}
                  alt={modalProduct.title}
                  className="w-full h-64 object-cover rounded-xl shadow"
                />
                {modalProduct.images.length > 1 && (
                  <div className="absolute bottom-3 right-3 bg-white/90 p-2 rounded-lg">
                    {modalProduct.images.length}+
                  </div>
                )}
              </div>
              <div className="flex flex-col justify-center">
                <h1 className="text-2xl font-bold mb-2">{modalProduct.title}</h1>
                <p className="text-sm text-gray-500 mb-4">Seller: {modalProduct.sellerName}</p>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-3xl font-bold text-gray-900">₹{modalProduct.discountPrice}</span>
                  <span className="text-lg text-gray-400 line-through">₹{modalProduct.price}</span>
                  <span className="text-xs text-green-600 font-bold">
                    {Math.round(((modalProduct.price - modalProduct.discountPrice) / modalProduct.price) * 100)}% OFF
                  </span>
                </div>
                <div className="mb-4">
                  <p className="text-xs font-bold text-gray-500 uppercase mb-1">Availability</p>
                  <span className={`text-sm font-medium ${modalProduct.stock > 0 ? "text-green-600" : "text-red-600"}`}>
                    {modalProduct.stock > 0 ? `In Stock ({modalProduct.stock} available)` : "Out of Stock"}
                  </span>
                </div>
                <div className="mb-6">
                  <p className="text-xs font-bold text-gray-500 uppercase mb-1">Full Description</p>
                  <p className="text-gray-700 leading-relaxed">{modalProduct.description}</p>
                </div>
                <button
                  onClick={() => {
                    addToCart(modalProduct);
                    closeProductModal();
                  }}
                  disabled={modalProduct.stock === 0}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {modalProduct.stock === 0 ? "Out of Stock" : "Add to Cart"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}