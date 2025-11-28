import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Switch } from '../ui/switch';
import { Checkbox } from '../ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Progress } from '../ui/progress';
import { Separator } from '../ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { ScrollArea } from '../ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { BackgroundGradientAnimation } from '../ui/background-gradient-animation';
import { GradientCard } from '../ui/gradient-card';
import MagicGlowEffect from './MagicGlowEffect';
import { GlowCard, CardHeader as GlowCardHeader, CardFooter, CardTitle as GlowCardTitle, CardDescription, CardContent as GlowCardContent } from './GlowCard';
import CandidateList from './CandidateList';

export function UITestDashboard() {
  const [progress, setProgress] = useState(33);
  const [switchState, setSwitchState] = useState(false);
  const [checkboxState, setCheckboxState] = useState(false);
  const [radioValue, setRadioValue] = useState("option1");
  const [magicGlowState, setMagicGlowState] = useState("idle");
  const [glowCardState, setGlowCardState] = useState("idle");

  // Mock candidate data
  const mockCandidates = [
    {
      id: '1',
      name: 'Sarah Chen',
      title: 'Senior Software Engineer',
      experience: '5 years experience',
      ragScore: 92,
      skills: ['React', 'TypeScript', 'Node.js', 'GraphQL', 'AWS'],
      company: 'TechCorp Inc.',
      pros: ['Strong technical leadership skills', 'Extensive experience with modern React patterns', 'Proven track record with scalable architectures'],
      cons: ['Limited mobile development experience', 'No direct experience with our specific industry domain']
    },
    {
      id: '2',
      name: 'Marcus Johnson',
      title: 'Full Stack Developer',
      experience: '3 years experience',
      ragScore: 78,
      skills: ['Python', 'Django', 'PostgreSQL', 'Docker', 'Redis'],
      company: 'DataSoft Solutions',
      pros: ['Solid backend development skills', 'Good understanding of database optimization'],
      cons: ['Limited frontend framework experience', 'Relatively junior level', 'No cloud infrastructure experience']
    },
    {
      id: '3',
      name: 'Emily Rodriguez',
      title: 'Frontend Developer',
      experience: '4 years experience',
      ragScore: 85,
      skills: ['Vue.js', 'JavaScript', 'CSS', 'Figma', 'Webpack'],
      company: 'Creative Studios',
      pros: ['Excellent UI/UX sensibilities', 'Strong collaboration with design teams', 'Performance optimization expertise'],
      cons: ['Limited backend integration experience', 'No experience with React ecosystem']
    },
    {
      id: '4',
      name: 'David Kim',
      title: 'DevOps Engineer',
      experience: '6 years experience',
      ragScore: 95,
      skills: ['Kubernetes', 'AWS', 'Terraform', 'Jenkins', 'Monitoring'],
      company: 'CloudTech Ltd',
      pros: ['Expert-level cloud infrastructure knowledge', 'Strong automation and CI/CD experience', 'Excellent problem-solving skills', 'Security-first mindset'],
      cons: ['Limited application development background']
    },
    {
      id: '5',
      name: 'Lisa Wang',
      title: 'UI/UX Designer',
      experience: '3 years experience',
      ragScore: 72,
      skills: ['Figma', 'Adobe XD', 'User Research', 'Prototyping', 'Design Systems'],
      company: 'Design Co',
      pros: ['Strong user research methodology', 'Great design system thinking'],
      cons: ['Limited technical implementation knowledge', 'No experience with complex enterprise applications', 'Junior level for senior role requirements']
    }
  ];

  return (
    <div className="space-y-8">
      {/* Main Welcome Card */}
      <GradientCard 
        className="h-80"
        gradientBackgroundStart="rgb(255, 154, 0)"
        gradientBackgroundEnd="rgb(255, 87, 34)"
        firstColor="255, 183, 77"
        secondColor="255, 152, 0"
        thirdColor="255, 87, 34"
        fourthColor="255, 193, 7"
        fifthColor="255, 111, 0"
        pointerColor="255, 167, 38"
      >
        <div className="text-center text-white max-w-2xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-orange-100 to-yellow-100">
            Welcome to Bounteer
          </h1>
          <p className="text-lg text-white/95 mb-6 leading-relaxed">
            Discover opportunities, connect with talent, and build your future with our innovative bounty platform
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button className="bg-white/25 hover:bg-white/35 text-white border border-white/40 backdrop-blur-sm px-8 py-3 text-lg font-semibold">
              Get Started
            </Button>
            <Button variant="ghost" className="text-white border border-white/50 hover:bg-white/15 px-8 py-3 text-lg">
              Learn More
            </Button>
          </div>
        </div>
      </GradientCard>
      
      {/* Candidate List Section */}
      <Card>
        <CardHeader>
          <CardTitle>Vertical Candidate List</CardTitle>
        </CardHeader>
        <CardContent>
          <CandidateList candidates={mockCandidates} />
        </CardContent>
      </Card>
      
      {/* Gradient Animation Card */}
      <Card>
        <CardHeader>
          <CardTitle>Background Gradient Animation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 rounded-lg overflow-hidden">
            <BackgroundGradientAnimation
              containerClassName="h-full w-full rounded-lg"
              gradientBackgroundStart="rgb(108, 0, 162)"
              gradientBackgroundEnd="rgb(0, 17, 82)"
              firstColor="18, 113, 255"
              secondColor="221, 74, 255"
              thirdColor="100, 220, 255"
              fourthColor="200, 50, 50"
              fifthColor="180, 180, 50"
              pointerColor="140, 100, 255"
              interactive={true}
            >
              <div className="absolute inset-0 flex items-center justify-center z-20">
                <div className="text-center">
                  <h3 className="text-white text-2xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-300">
                    Animated Gradient Background
                  </h3>
                  <p className="text-white/80 text-sm">
                    Interactive gradient animation with mouse movement
                  </p>
                </div>
              </div>
            </BackgroundGradientAnimation>
          </div>
        </CardContent>
      </Card>

      {/* Gradient Card Component */}
      <Card>
        <CardHeader>
          <CardTitle>Gradient Card Component</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <GradientCard className="h-48">
              <div className="text-center text-white">
                <h3 className="text-2xl font-bold mb-2">Welcome to Bounteer</h3>
                <p className="text-white/80">This is a card with gradient background</p>
                <Button className="mt-4 bg-white/20 hover:bg-white/30 text-white border border-white/30">
                  Get Started
                </Button>
              </div>
            </GradientCard>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <GradientCard 
                className="h-32"
                gradientBackgroundStart="rgb(255, 0, 150)"
                gradientBackgroundEnd="rgb(0, 204, 255)"
                firstColor="255, 100, 200"
                secondColor="100, 200, 255"
              >
                <div className="text-center text-white">
                  <h4 className="font-semibold">Pink & Blue</h4>
                  <p className="text-sm text-white/80">Custom colors</p>
                </div>
              </GradientCard>
              
              <GradientCard 
                className="h-32"
                gradientBackgroundStart="rgb(255, 154, 0)"
                gradientBackgroundEnd="rgb(255, 206, 84)"
                firstColor="255, 200, 100"
                secondColor="255, 150, 50"
                interactive={false}
              >
                <div className="text-center text-white">
                  <h4 className="font-semibold">Orange Sunset</h4>
                  <p className="text-sm text-white/80">Static animation</p>
                </div>
              </GradientCard>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Magic Glow Effect Component */}
      <Card>
        <CardHeader>
          <CardTitle>Magic Glow Effect</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex gap-4 flex-wrap">
              <Button 
                size="sm"
                variant={magicGlowState === "idle" ? "default" : "outline"}
                onClick={() => setMagicGlowState("idle")}
              >
                Idle
              </Button>
              <Button 
                size="sm"
                variant={magicGlowState === "listening" ? "default" : "outline"}
                onClick={() => setMagicGlowState("listening")}
              >
                Listening
              </Button>
              <Button 
                size="sm"
                variant={magicGlowState === "processing" ? "default" : "outline"}
                onClick={() => setMagicGlowState("processing")}
              >
                Processing
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MagicGlowEffect 
                glowState={magicGlowState}
                className="h-48 p-6 flex items-center justify-center bg-gray-900/50"
              >
                <div className="text-center text-white">
                  <h3 className="text-xl font-bold mb-2">Magic Glow Effect</h3>
                  <p className="text-white/80 text-sm">State: {magicGlowState}</p>
                  <p className="text-white/60 text-xs mt-1">Cyan primary with subtle effects</p>
                </div>
              </MagicGlowEffect>
              
              <MagicGlowEffect 
                glowState="processing"
                primaryColor="#ff6b6b"
                accentColor="#4ecdc4"
                glowSize={16}
                className="h-48 p-6 flex items-center justify-center bg-gray-900/50"
                borderRadius="rounded-2xl"
              >
                <div className="text-center text-white">
                  <h4 className="font-semibold mb-1">Custom Colors</h4>
                  <p className="text-white/80 text-sm">Red & Teal</p>
                  <p className="text-white/60 text-xs">Larger glow size</p>
                </div>
              </MagicGlowEffect>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Glow Card Component */}
      <Card>
        <CardHeader>
          <CardTitle>Glow Card</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex gap-4 flex-wrap">
              <Button 
                size="sm"
                variant={glowCardState === "idle" ? "default" : "outline"}
                onClick={() => setGlowCardState("idle")}
              >
                Idle
              </Button>
              <Button 
                size="sm"
                variant={glowCardState === "listening" ? "default" : "outline"}
                onClick={() => setGlowCardState("listening")}
              >
                Listening
              </Button>
              <Button 
                size="sm"
                variant={glowCardState === "processing" ? "default" : "outline"}
                onClick={() => setGlowCardState("processing")}
              >
                Processing
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <GlowCard 
                glowState={glowCardState}
                primaryColor="#ff6b35"
                className="h-48"
              >
                <GlowCardHeader>
                  <GlowCardTitle className="text-lg">Glow Card</GlowCardTitle>
                  <CardDescription>State: {glowCardState}</CardDescription>
                </GlowCardHeader>
                <GlowCardContent>
                  <p className="text-sm text-muted-foreground">
                    This is a ShadCN card with glow effects. It maintains all card functionality while adding interactive glow states.
                  </p>
                </GlowCardContent>
              </GlowCard>
              
              <GlowCard 
                glowState="processing"
                primaryColor="#ff6b35"
                accentColor="#ff8c42"
                glowSize={20}
                className="h-48"
              >
                <GlowCardHeader>
                  <GlowCardTitle className="text-lg">Custom Glow Card</GlowCardTitle>
                  <CardDescription>Orange theme</CardDescription>
                </GlowCardHeader>
                <GlowCardContent>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Processing</Badge>
                    <span className="text-xs text-muted-foreground">Enhanced glow</span>
                  </div>
                </GlowCardContent>
                <CardFooter>
                  <Button size="sm" className="w-full">Action Button</Button>
                </CardFooter>
              </GlowCard>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Buttons Section */}
      <Card>
        <CardHeader>
          <CardTitle>Buttons</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
          </div>
        </CardContent>
      </Card>

      {/* Form Elements */}
      <Card>
        <CardHeader>
          <CardTitle>Form Elements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="input-test">Input Field</Label>
            <Input id="input-test" placeholder="Enter text here..." />
          </div>
          <div>
            <Label htmlFor="textarea-test">Textarea</Label>
            <Textarea id="textarea-test" placeholder="Enter longer text here..." />
          </div>
          <div className="flex items-center space-x-2">
            <Switch 
              id="switch-test" 
              checked={switchState}
              onCheckedChange={setSwitchState}
            />
            <Label htmlFor="switch-test">Toggle Switch</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="checkbox-test"
              checked={checkboxState}
              onCheckedChange={setCheckboxState}
            />
            <Label htmlFor="checkbox-test">Checkbox</Label>
          </div>
          <div>
            <Label>Radio Group</Label>
            <RadioGroup value={radioValue} onValueChange={setRadioValue}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="option1" id="option1" />
                <Label htmlFor="option1">Option 1</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="option2" id="option2" />
                <Label htmlFor="option2">Option 2</Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Display Elements */}
      <Card>
        <CardHeader>
          <CardTitle>Display Elements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Badges</Label>
            <div className="flex gap-2 mt-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Badge variant="outline">Outline</Badge>
            </div>
          </div>
          <div>
            <Label>Avatar</Label>
            <div className="flex gap-2 mt-2">
              <Avatar>
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>JD</AvatarFallback>
              </Avatar>
            </div>
          </div>
          <div>
            <Label>Progress Bar</Label>
            <div className="space-y-2 mt-2">
              <Progress value={progress} />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setProgress(Math.max(0, progress - 10))}>
                  Decrease
                </Button>
                <Button size="sm" onClick={() => setProgress(Math.min(100, progress + 10))}>
                  Increase
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interactive Elements */}
      <Card>
        <CardHeader>
          <CardTitle>Interactive Elements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Dropdown Menu</Label>
            <div className="mt-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">Open Menu</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>Profile</DropdownMenuItem>
                  <DropdownMenuItem>Settings</DropdownMenuItem>
                  <DropdownMenuItem>Logout</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Data Display */}
      <Card>
        <CardHeader>
          <CardTitle>Data Display</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label>Scroll Area</Label>
              <ScrollArea className="h-32 w-full border rounded p-2 mt-2">
                <div className="space-y-2">
                  {Array.from({ length: 20 }, (_, i) => (
                    <div key={i} className="text-sm">
                      Item {i + 1} - This is scrollable content
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
            <div>
              <Label>Table</Label>
              <div className="mt-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Item 1</TableCell>
                      <TableCell><Badge>Active</Badge></TableCell>
                      <TableCell><Button size="sm">Edit</Button></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Item 2</TableCell>
                      <TableCell><Badge variant="secondary">Inactive</Badge></TableCell>
                      <TableCell><Button size="sm">Edit</Button></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}