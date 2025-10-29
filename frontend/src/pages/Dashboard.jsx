import { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Droplets, Thermometer, Package, AlertTriangle, Plus, Trash2, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [simulatingId, setSimulatingId] = useState(null);

  const [newProduct, setNewProduct] = useState({
    name: "",
    product_type: "",
    batch_number: "",
    quantity: "",
    unit: "L"
  });

  useEffect(() => {
    fetchData();
    fetchProductTypes();
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      fetchData();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [productsRes, alertsRes] = await Promise.all([
        axios.get(`${API}/products`),
        axios.get(`${API}/alerts`)
      ]);
      setProducts(productsRes.data);
      setAlerts(alertsRes.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch data");
      setLoading(false);
    }
  };

  const fetchProductTypes = async () => {
    try {
      const response = await axios.get(`${API}/product-types`);
      setProductTypes(response.data);
    } catch (error) {
      console.error("Error fetching product types:", error);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    
    if (!newProduct.name || !newProduct.product_type || !newProduct.batch_number || !newProduct.quantity) {
      toast.error("Please fill all fields");
      return;
    }

    try {
      await axios.post(`${API}/products`, {
        ...newProduct,
        quantity: parseFloat(newProduct.quantity)
      });
      
      toast.success("Product added successfully!");
      setIsDialogOpen(false);
      setNewProduct({
        name: "",
        product_type: "",
        batch_number: "",
        quantity: "",
        unit: "L"
      });
      fetchData();
    } catch (error) {
      console.error("Error adding product:", error);
      toast.error("Failed to add product");
    }
  };

  const handleDeleteProduct = async (productId) => {
    try {
      await axios.delete(`${API}/products/${productId}`);
      toast.success("Product deleted");
      fetchData();
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("Failed to delete product");
    }
  };

  const handleSimulateSensor = async (productId) => {
    setSimulatingId(productId);
    try {
      await axios.post(`${API}/simulate-sensor/${productId}`);
      toast.success("Sensor data simulated");
      fetchData();
    } catch (error) {
      console.error("Error simulating sensor:", error);
      toast.error("Failed to simulate sensor");
    } finally {
      setSimulatingId(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "fresh":
        return "bg-emerald-500 hover:bg-emerald-600";
      case "good":
        return "bg-blue-500 hover:bg-blue-600";
      case "warning":
        return "bg-amber-500 hover:bg-amber-600";
      case "expired":
        return "bg-red-500 hover:bg-red-600";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusGradient = (status) => {
    switch (status) {
      case "fresh":
        return "from-emerald-50 to-teal-50";
      case "good":
        return "from-blue-50 to-cyan-50";
      case "warning":
        return "from-amber-50 to-orange-50";
      case "expired":
        return "from-red-50 to-rose-50";
      default:
        return "from-gray-50 to-slate-50";
    }
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-2" data-testid="dashboard-title">
              Milk Shelf Life Monitor
            </h1>
            <p className="text-base sm:text-lg text-slate-600">Real-time monitoring of dairy products</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-6 py-6 rounded-full shadow-lg transition-all hover:shadow-xl"
                data-testid="add-product-button"
              >
                <Plus className="mr-2 h-5 w-5" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md" data-testid="add-product-dialog">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">Add New Product</DialogTitle>
                <DialogDescription>
                  Fill in the details to add a new dairy product for monitoring.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddProduct} className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="name">Product Name</Label>
                  <Input
                    id="name"
                    data-testid="product-name-input"
                    placeholder="e.g., Fresh Whole Milk"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="product_type">Product Type</Label>
                  <Select
                    value={newProduct.product_type}
                    onValueChange={(value) => setNewProduct({ ...newProduct, product_type: value })}
                  >
                    <SelectTrigger data-testid="product-type-select">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {productTypes.map((type) => (
                        <SelectItem key={type.type} value={type.type}>
                          {type.icon} {type.type.charAt(0).toUpperCase() + type.type.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="batch_number">Batch Number</Label>
                  <Input
                    id="batch_number"
                    data-testid="batch-number-input"
                    placeholder="e.g., BATCH001"
                    value={newProduct.batch_number}
                    onChange={(e) => setNewProduct({ ...newProduct, batch_number: e.target.value })}
                  />
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      data-testid="quantity-input"
                      type="number"
                      step="0.1"
                      placeholder="10"
                      value={newProduct.quantity}
                      onChange={(e) => setNewProduct({ ...newProduct, quantity: e.target.value })}
                    />
                  </div>
                  <div className="w-24">
                    <Label htmlFor="unit">Unit</Label>
                    <Select
                      value={newProduct.unit}
                      onValueChange={(value) => setNewProduct({ ...newProduct, unit: value })}
                    >
                      <SelectTrigger data-testid="unit-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="L">L</SelectItem>
                        <SelectItem value="kg">kg</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                  data-testid="submit-product-button"
                >
                  Add Product
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Alerts Section */}
        {alerts.length > 0 && (
          <div className="mb-6" data-testid="alerts-section">
            <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
              <CardHeader>
                <CardTitle className="flex items-center text-amber-900">
                  <AlertTriangle className="mr-2 h-5 w-5" />
                  Alerts ({alerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {alerts.map((alert, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-200"
                      data-testid={`alert-${idx}`}
                    >
                      <span className="font-medium text-slate-700">{alert.message}</span>
                      <Badge className={getStatusColor(alert.status)}>
                        {alert.status.toUpperCase()}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600" data-testid="total-products">{products.length}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Fresh</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-600" data-testid="fresh-count">
                {products.filter(p => p.status === "fresh").length}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Warning</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600" data-testid="warning-count">
                {products.filter(p => p.status === "warning").length}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Expired</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600" data-testid="expired-count">
                {products.filter(p => p.status === "expired").length}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Products Grid */}
      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-slate-600">Loading products...</p>
          </div>
        ) : products.length === 0 ? (
          <Card className="p-12 text-center bg-white/80 backdrop-blur-sm">
            <Package className="h-16 w-16 mx-auto text-slate-300 mb-4" />
            <p className="text-xl text-slate-600 mb-2">No products yet</p>
            <p className="text-slate-500 mb-4">Add your first dairy product to start monitoring</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="products-grid">
            {products.map((product) => (
              <Card 
                key={product.id} 
                className={`bg-gradient-to-br ${getStatusGradient(product.status)} border-2 hover:shadow-xl transition-all duration-300 backdrop-blur-sm`}
                data-testid={`product-card-${product.id}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <CardTitle className="text-xl mb-1" data-testid={`product-name-${product.id}`}>{product.name}</CardTitle>
                      <p className="text-sm text-slate-600 capitalize">
                        {product.product_type} • {product.quantity} {product.unit}
                      </p>
                    </div>
                    <Badge className={getStatusColor(product.status)} data-testid={`product-status-${product.id}`}>
                      {product.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">Batch: {product.batch_number}</p>
                </CardHeader>
                <CardContent>
                  {/* Shelf Life Progress */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-slate-700">Shelf Life</span>
                      <span className="text-sm font-bold" data-testid={`shelf-life-${product.id}`}>
                        {Math.round(product.shelf_life_percentage)}%
                      </span>
                    </div>
                    <Progress value={product.shelf_life_percentage} className="h-2" />
                  </div>

                  {/* Sensor Data */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-white/50 rounded-lg p-3 backdrop-blur-sm">
                      <div className="flex items-center mb-1">
                        <Thermometer className="h-4 w-4 mr-1 text-red-500" />
                        <span className="text-xs text-slate-600">Temperature</span>
                      </div>
                      <p className="text-lg font-bold text-slate-800" data-testid={`temperature-${product.id}`}>
                        {product.current_temperature?.toFixed(1)}°C
                      </p>
                    </div>
                    <div className="bg-white/50 rounded-lg p-3 backdrop-blur-sm">
                      <div className="flex items-center mb-1">
                        <Droplets className="h-4 w-4 mr-1 text-blue-500" />
                        <span className="text-xs text-slate-600">Humidity</span>
                      </div>
                      <p className="text-lg font-bold text-slate-800" data-testid={`humidity-${product.id}`}>
                        {product.current_humidity?.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(`/product/${product.id}`)}
                      data-testid={`view-details-${product.id}`}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Details
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 bg-blue-50 hover:bg-blue-100"
                      onClick={() => handleSimulateSensor(product.id)}
                      disabled={simulatingId === product.id}
                      data-testid={`simulate-${product.id}`}
                    >
                      {simulatingId === product.id ? "Simulating..." : "Simulate"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-red-50 hover:bg-red-100"
                      onClick={() => handleDeleteProduct(product.id)}
                      data-testid={`delete-${product.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;