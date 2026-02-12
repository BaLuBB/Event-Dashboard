import requests
import sys
import json
from datetime import datetime

class EventDashboardAPITester:
    def __init__(self, base_url="https://eventpulse-app-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, auth_required=False):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            print(f"   Status: {response.status_code}")
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {response.text}")
                self.failed_tests.append({
                    'test': name,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'endpoint': endpoint
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                'test': name,
                'error': str(e),
                'endpoint': endpoint
            })
            return False, {}

    def test_health_check(self):
        """Test API health check"""
        return self.run_test("API Health Check", "GET", "", 200)

    def test_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"username": "admin", "password": "admin123"}
        )
        if success and 'token' in response:
            self.token = response['token']
            print(f"   Token obtained: {self.token[:20]}...")
            return True
        return False

    def test_verify_token(self):
        """Test token verification"""
        return self.run_test("Token Verification", "GET", "auth/verify", 200, auth_required=True)

    def test_get_settings(self):
        """Test get settings"""
        return self.run_test("Get Settings", "GET", "settings", 200)

    def test_update_settings(self):
        """Test update settings"""
        return self.run_test(
            "Update Settings",
            "PUT",
            "settings",
            200,
            data={"event_name": "Test Event Updated"},
            auth_required=True
        )

    def test_get_phases(self):
        """Test get phases"""
        success, response = self.run_test("Get Phases", "GET", "phases", 200)
        if success:
            print(f"   Found {len(response)} phases")
        return success, response

    def test_create_phase(self):
        """Test create phase"""
        success, response = self.run_test(
            "Create Phase",
            "POST",
            "phases",
            200,
            data={"name": "Test Phase", "color": "#ff0000", "order": 99},
            auth_required=True
        )
        return success, response

    def test_get_schedule(self):
        """Test get schedule"""
        success, response = self.run_test("Get Schedule", "GET", "schedule", 200)
        if success:
            print(f"   Found {len(response)} schedule items")
        return success, response

    def test_create_schedule_item(self):
        """Test create schedule item"""
        success, response = self.run_test(
            "Create Schedule Item",
            "POST",
            "schedule",
            200,
            data={
                "title": "Test Event",
                "description": "Test Description",
                "start_time": "10:00",
                "end_time": "11:00",
                "notes": "Test notes"
            },
            auth_required=True
        )
        return success, response

    def test_control_operations(self, schedule_items):
        """Test control operations"""
        results = []
        
        # Test pause
        success, _ = self.run_test("Control Pause", "POST", "control/pause", 200, auth_required=True)
        results.append(('pause', success))
        
        # Test next
        success, _ = self.run_test("Control Next", "POST", "control/next", 200, auth_required=True)
        results.append(('next', success))
        
        # Test previous
        success, _ = self.run_test("Control Previous", "POST", "control/previous", 200, auth_required=True)
        results.append(('previous', success))
        
        # Test set current (if we have schedule items)
        if schedule_items and len(schedule_items) > 0:
            item_id = schedule_items[0]['id']
            success, _ = self.run_test(
                "Control Set Current",
                "POST",
                f"control/set-current/{item_id}",
                200,
                auth_required=True
            )
            results.append(('set-current', success))
        
        # Test clear current
        success, _ = self.run_test("Control Clear Current", "POST", "control/clear-current", 200, auth_required=True)
        results.append(('clear-current', success))
        
        return results

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Event Dashboard API Tests")
        print("=" * 50)
        
        # Health check
        if not self.test_health_check()[0]:
            print("❌ API is not responding. Stopping tests.")
            return False
        
        # Authentication
        if not self.test_login():
            print("❌ Login failed. Stopping tests.")
            return False
        
        if not self.test_verify_token()[0]:
            print("❌ Token verification failed.")
        
        # Settings
        self.test_get_settings()
        self.test_update_settings()
        
        # Phases
        phases_success, phases = self.test_get_phases()
        created_phase_success, created_phase = self.test_create_phase()
        
        # Schedule
        schedule_success, schedule_items = self.test_get_schedule()
        created_item_success, created_item = self.test_create_schedule_item()
        
        # Get updated schedule for control tests
        if created_item_success:
            _, updated_schedule = self.test_get_schedule()
            schedule_items = updated_schedule
        
        # Control operations
        control_results = self.test_control_operations(schedule_items)
        
        # Cleanup - delete created items
        if created_phase_success and created_phase:
            self.run_test(
                "Delete Test Phase",
                "DELETE",
                f"phases/{created_phase['id']}",
                200,
                auth_required=True
            )
        
        if created_item_success and created_item:
            self.run_test(
                "Delete Test Schedule Item",
                "DELETE",
                f"schedule/{created_item['id']}",
                200,
                auth_required=True
            )
        
        return True

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {len(self.failed_tests)}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in self.failed_tests:
                error_msg = test.get('error', f"Expected {test.get('expected')}, got {test.get('actual')}")
                print(f"  - {test['test']}: {error_msg}")
        
        return len(self.failed_tests) == 0

def main():
    tester = EventDashboardAPITester()
    
    try:
        tester.run_all_tests()
        success = tester.print_summary()
        return 0 if success else 1
    except KeyboardInterrupt:
        print("\n\n⚠️ Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n\n💥 Unexpected error: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())