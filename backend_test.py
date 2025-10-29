import requests
import sys
import json
from datetime import datetime
import time

class MilkShelfLifeAPITester:
    def __init__(self, base_url="https://milkshelf.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.created_products = []
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if success:
                try:
                    response_data = response.json()
                    details += f", Response: {json.dumps(response_data, indent=2)[:200]}..."
                    self.log_test(name, True, details)
                    return True, response_data
                except:
                    self.log_test(name, True, details)
                    return True, {}
            else:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data}"
                except:
                    details += f", Error: {response.text[:200]}"
                self.log_test(name, False, details)
                return False, {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test("Root API Endpoint", "GET", "", 200)

    def test_get_product_types(self):
        """Test getting product types"""
        success, data = self.run_test("Get Product Types", "GET", "product-types", 200)
        if success and isinstance(data, list) and len(data) == 5:
            expected_types = ["milk", "cheese", "yogurt", "butter", "cream"]
            actual_types = [item["type"] for item in data]
            if all(ptype in actual_types for ptype in expected_types):
                print("   ✓ All 5 product types present")
                return True, data
            else:
                print(f"   ✗ Missing product types. Expected: {expected_types}, Got: {actual_types}")
        return success, data

    def test_create_product(self, product_data):
        """Test creating a product"""
        success, data = self.run_test(
            f"Create Product - {product_data['name']}", 
            "POST", 
            "products", 
            200, 
            product_data
        )
        if success and 'id' in data:
            self.created_products.append(data['id'])
            print(f"   ✓ Product created with ID: {data['id']}")
        return success, data

    def test_get_products(self):
        """Test getting all products"""
        return self.run_test("Get All Products", "GET", "products", 200)

    def test_get_product_by_id(self, product_id):
        """Test getting a specific product"""
        return self.run_test(
            f"Get Product by ID - {product_id[:8]}", 
            "GET", 
            f"products/{product_id}", 
            200
        )

    def test_simulate_sensor(self, product_id):
        """Test sensor simulation"""
        return self.run_test(
            f"Simulate Sensor - {product_id[:8]}", 
            "POST", 
            f"simulate-sensor/{product_id}", 
            200
        )

    def test_get_sensor_data(self, product_id):
        """Test getting sensor data"""
        return self.run_test(
            f"Get Sensor Data - {product_id[:8]}", 
            "GET", 
            f"sensor-data/{product_id}", 
            200
        )

    def test_get_alerts(self):
        """Test getting alerts"""
        return self.run_test("Get Alerts", "GET", "alerts", 200)

    def test_delete_product(self, product_id):
        """Test deleting a product"""
        return self.run_test(
            f"Delete Product - {product_id[:8]}", 
            "DELETE", 
            f"products/{product_id}", 
            200
        )

    def run_comprehensive_test(self):
        """Run all tests in sequence"""
        print("🧪 Starting Milk Shelf Life API Tests")
        print("=" * 50)

        # Test 1: Root endpoint
        self.test_root_endpoint()

        # Test 2: Product types
        success, product_types = self.test_get_product_types()
        if not success:
            print("❌ Critical: Product types endpoint failed")
            return False

        # Test 3: Create products for each type
        test_products = [
            {
                "name": "Fresh Whole Milk",
                "product_type": "milk",
                "batch_number": "MILK001",
                "quantity": 2.0,
                "unit": "L"
            },
            {
                "name": "Aged Cheddar",
                "product_type": "cheese",
                "batch_number": "CHEESE001",
                "quantity": 0.5,
                "unit": "kg"
            },
            {
                "name": "Greek Yogurt",
                "product_type": "yogurt",
                "batch_number": "YOGURT001",
                "quantity": 1.0,
                "unit": "kg"
            },
            {
                "name": "Salted Butter",
                "product_type": "butter",
                "batch_number": "BUTTER001",
                "quantity": 0.25,
                "unit": "kg"
            },
            {
                "name": "Heavy Cream",
                "product_type": "cream",
                "batch_number": "CREAM001",
                "quantity": 0.5,
                "unit": "L"
            }
        ]

        for product in test_products:
            self.test_create_product(product)

        # Test 4: Get all products
        success, all_products = self.test_get_products()
        if success and len(all_products) >= len(self.created_products):
            print(f"   ✓ Found {len(all_products)} products in database")

        # Test 5: Test individual product operations
        for product_id in self.created_products:
            # Get individual product
            self.test_get_product_by_id(product_id)
            
            # Simulate sensor
            self.test_simulate_sensor(product_id)
            
            # Wait a moment for sensor data to be recorded
            time.sleep(0.5)
            
            # Get sensor data
            success, sensor_data = self.test_get_sensor_data(product_id)
            if success and isinstance(sensor_data, list) and len(sensor_data) > 0:
                print(f"   ✓ Found {len(sensor_data)} sensor readings")

        # Test 6: Get alerts
        self.test_get_alerts()

        # Test 7: Delete products (cleanup)
        for product_id in self.created_products:
            self.test_delete_product(product_id)

        # Final verification - products should be deleted
        success, final_products = self.test_get_products()
        if success:
            remaining_test_products = [p for p in final_products if p['id'] in self.created_products]
            if len(remaining_test_products) == 0:
                print("   ✓ All test products successfully deleted")
            else:
                print(f"   ✗ {len(remaining_test_products)} test products still exist")

        return True

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 ALL TESTS PASSED!")
            return True
        else:
            print("❌ SOME TESTS FAILED")
            failed_tests = [r for r in self.test_results if not r['success']]
            print("\nFailed Tests:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['details']}")
            return False

def main():
    tester = MilkShelfLifeAPITester()
    
    try:
        success = tester.run_comprehensive_test()
        all_passed = tester.print_summary()
        
        return 0 if all_passed else 1
        
    except Exception as e:
        print(f"❌ Test execution failed: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())