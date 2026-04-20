// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Crowdfunding {

    struct Campaign {
        address creator;
        string name;
        uint goal;
        uint pledged;
        uint deadline;
        bool claimed;
    }

    uint public count;

    mapping(uint => Campaign) public campaigns;
    mapping(uint => mapping(address => uint)) public pledgedAmount;

    function openCampaignCount(address creator) public view returns (uint) {
        uint total = 0;
        for (uint i = 1; i <= count; i++) {
            Campaign storage c = campaigns[i];
            if (c.creator == creator && !c.claimed && block.timestamp < c.deadline) {
                total++;
            }
        }
        return total;
    }

    event CampaignCreated(
        uint indexed id,
        address indexed creator,
        string name,
        uint goal,
        uint duration,
        uint deadline
    );
    event Pledged(
        uint indexed id,
        address indexed contributor,
        uint amount,
        uint totalPledged
    );
    event Claimed(
        uint indexed id,
        address indexed creator,
        uint amount
    );
    event Refunded(
        uint indexed id,
        address indexed contributor,
        uint amount
    );

    // 🟢 Tạo campaign
    function createCampaign(string calldata _name, uint _goal, uint _duration) public {
        require(bytes(_name).length > 0 && bytes(_name).length <= 32, "Invalid name");
        require(openCampaignCount(msg.sender) < 5, "Too many active campaigns");
        count++;
        uint deadline = block.timestamp + _duration;
        campaigns[count] = Campaign({
            creator: msg.sender,
            name: _name,
            goal: _goal,
            pledged: 0,
            deadline: deadline,
            claimed: false
        });

        emit CampaignCreated(count, msg.sender, _name, _goal, _duration, deadline);
    }

    // 💰 Góp vốn
    function pledge(uint _id) public payable {
        Campaign storage c = campaigns[_id];

        require(block.timestamp < c.deadline, "Campaign ended");

        c.pledged += msg.value;
        pledgedAmount[_id][msg.sender] += msg.value;

        emit Pledged(_id, msg.sender, msg.value, c.pledged);
    }

    // 🏆 Rút tiền (nếu đạt goal)
    function claim(uint _id) public {
        Campaign storage c = campaigns[_id];

        require(msg.sender == c.creator, "Not creator");
        require(c.pledged >= c.goal, "Goal not reached");
        require(!c.claimed, "Already claimed");

        c.claimed = true;
        payable(c.creator).transfer(c.pledged);

        emit Claimed(_id, c.creator, c.pledged);
    }

    // 🔄 Hoàn tiền (nếu fail)
    function refund(uint _id) public {
        Campaign storage c = campaigns[_id];

        require(block.timestamp > c.deadline, "Not ended");
        require(c.pledged < c.goal, "Goal reached");

        uint bal = pledgedAmount[_id][msg.sender];
        pledgedAmount[_id][msg.sender] = 0;

        payable(msg.sender).transfer(bal);

        emit Refunded(_id, msg.sender, bal);
    }
}