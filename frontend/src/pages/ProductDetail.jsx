import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Thermometer, Droplets, Calendar, RefreshCw } from "lucide-react";
import { format } from "date-fns";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [sensorData, setSensorData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    fetchProductData();
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      fetchProductData();
    }, 5000);

    return () => clearInterval(interval);
  }, [id]);

  const fetchProductData = async () => {
    try {
      const [productRes, sensorRes] = await Promise.all([
        axios.get(`${API}/products/${id}`),
        axios.get(`${API}/sensor-data/${id}`)
      ]);
      setProduct(productRes.data);
      setSensorData(sensorRes.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching product data:", error);
      toast.error("Failed to fetch product data");
      setLoading(false);
    }
  };

  const handleSimulateSensor = async () => {
    setSimulating(true);
    try {
      await axios.post(`${API}/simulate-sensor/${id}`);
      toast.success("Sensor data simulated");
      fetchProductData();
    } catch (error) {
      console.error("Error simulating sensor:", error);
      toast.error("Failed to simulate sensor");
    } finally {
      setSimulating(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "fresh":
        return "bg-emerald-500";
      case "good":
        return "bg-blue-500";
      case "warning":
        return "bg-amber-500";
      case "expired":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-slate-600 mb-4">Product not found</p>
          <Button onClick={() => navigate("/")}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button 
            variant="outline" 
            onClick={() => navigate("/")} 
            className="mb-4"
            data-testid="back-button"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 mb-2" data-testid="product-detail-title">
                {product.name}
              </h1>
              <p className="text-lg text-slate-600 capitalize">
                {product.product_type} • Batch: {product.batch_number}
              </p>
            </div>
            <div className="flex gap-3">
              <Badge className={`${getStatusColor(product.status)} text-white px-4 py-2 text-lg`} data-testid="product-detail-status">
                {product.status.toUpperCase()}
              </Badge>
              <Button
                onClick={handleSimulateSensor}
                disabled={simulating}
                className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                data-testid="simulate-sensor-button"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${simulating ? 'animate-spin' : ''}`} />
                Simulate Sensor
              </Button>
            </div>
          </div>
        </div>

        {/* Main Info Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Shelf Life Card */}
          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2">
            <CardHeader>
              <CardTitle>Shelf Life Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-slate-700">Remaining</span>
                    <span className="text-2xl font-bold text-blue-600" data-testid="shelf-life-percentage">
                      {Math.round(product.shelf_life_percentage)}%
                    </span>
                  </div>
                  <Progress value={product.shelf_life_percentage} className="h-3" />
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Added Date</p>
                    <p className="font-semibold text-slate-800" data-testid="added-date">
                      {format(new Date(product.added_date), "MMM dd, yyyy")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Est. Expiry</p>
                    <p className="font-semibold text-slate-800" data-testid="expiry-date">
                      {product.estimated_expiry ? format(new Date(product.estimated_expiry), "MMM dd, yyyy") : "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Conditions */}
          <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2">
            <CardHeader>
              <CardTitle>Current Storage Conditions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center mb-2">
                    <Thermometer className="h-5 w-5 mr-2 text-red-500" />
                    <span className="text-sm text-slate-600">Temperature</span>
                  </div>
                  <p className="text-3xl font-bold text-slate-800" data-testid="current-temperature">
                    {product.current_temperature?.toFixed(1)}°C
                  </p>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center mb-2">
                    <Droplets className="h-5 w-5 mr-2 text-blue-500" />
                    <span className="text-sm text-slate-600">Humidity</span>
                  </div>
                  <p className="text-3xl font-bold text-slate-800" data-testid="current-humidity">
                    {product.current_humidity?.toFixed(1)}%
                  </p>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-white rounded-lg">
                <p className="text-sm text-slate-600 mb-1">Quantity</p>
                <p className="text-xl font-semibold text-slate-800">
                  {product.quantity} {product.unit}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sensor History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="mr-2 h-5 w-5" />
              Sensor Reading History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sensorData.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No sensor data available</p>
            ) : (
              <div className="space-y-3" data-testid="sensor-history">
                {sensorData.map((reading, idx) => (
                  <div 
                    key={reading.id} 
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                    data-testid={`sensor-reading-${idx}`}
                  >
                    <div className="flex items-center gap-6">
                      <div className="flex items-center">
                        <Thermometer className="h-4 w-4 mr-2 text-red-500" />
                        <span className="font-semibold text-slate-800">{reading.temperature.toFixed(1)}°C</span>
                      </div>
                      <div className="flex items-center">
                        <Droplets className="h-4 w-4 mr-2 text-blue-500" />
                        <span className="font-semibold text-slate-800">{reading.humidity.toFixed(1)}%</span>
                      </div>
                    </div>
                    <span className="text-sm text-slate-500">
                      {format(new Date(reading.timestamp), "MMM dd, yyyy HH:mm:ss")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProductDetail;